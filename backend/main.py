import json
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict, field_validator

from database import Base, engine, get_db, Experiment

app = FastAPI()
Base.metadata.create_all(bind=engine)

origins = [
    "http://localhost:5173",  # Default Vite port
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allows all request headers
)

# -- Pydantic Schemas -- #

class QMCParameters(BaseModel):
    stock_price: float
    volatility: float
    strike_price: float
    n_shots: int
    simulator: str

# What the user provides
class ExperimentCreate(BaseModel):
    name: str
    algorithm: str
    parameters: QMCParameters

# What the server creates
class ExperimentResponse(BaseModel):
    # read from ORM
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    algorithm: str
    parameters: QMCParameters
    status: str
    created_at: datetime

    @field_validator("parameters", mode="before")
    @classmethod
    def parse_parameters(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v


# POST Route for creating new experiment

@app.post("/api/experiments", response_model=ExperimentResponse)
def create_experiment(experiment: ExperimentCreate, db: Session = Depends(get_db)):
    # build orm object
    db_experiment = Experiment(
        name=experiment.name,
        algorithm=experiment.algorithm,
        parameters=experiment.parameters.model_dump_json(),
    )
    db.add(db_experiment) # stage
    db.commit() # write to disk
    db.refresh(db_experiment) #re-read from db
    return db_experiment

# GET Route for getting all experiments

@app.get("/api/experiments", response_model=list[ExperimentResponse])
def get_experiments(db: Session = Depends(get_db)):
    # SELECT * FROM EXPERIMENTS
    return db.query(Experiment).all()

@app.delete("/api/experiments/{experiment_id}")
def delete_experiment(experiment_id: int, db: Session = Depends(get_db)):
    db_experiment = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not db_experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    db.delete(db_experiment)
    db.commit()
    return {"ok": True}