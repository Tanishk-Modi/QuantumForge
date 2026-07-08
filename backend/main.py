import json
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict, field_validator

from database import Base, engine, get_db, Experiment
from quantum.registry import get_runner
from typing import Optional

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
    risk_free_rate: float
    time_to_expiry: float
    num_uncertainty_qubits: int

# What the user provides
class ExperimentCreate(BaseModel):
    name: str
    algorithm: str
    # dict allows any arbitrary experiment params
    parameters: dict

# What the server creates
class ExperimentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    algorithm: str
    parameters: QMCParameters
    status: str
    created_at: datetime

    black_scholes_price: Optional[float] = None
    classical_mc_result: Optional[dict]  = None
    quantum_mc_result:   Optional[dict]  = None
    error_classical:     Optional[float] = None
    error_quantum:       Optional[float] = None

    @field_validator("parameters", mode="before")
    @classmethod
    def parse_parameters(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator("classical_mc_result", "quantum_mc_result", mode="before")
    @classmethod
    def parse_result_json(cls, v):
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
        parameters=json.dumps(experiment.parameters)
    )
    db.add(db_experiment) # stage
    db.commit() # write to disk
    db.refresh(db_experiment) #re-read from db

    db_experiment.status = "running"
    db.commit() # persists status

    # "queued" -> "running" -> "completed"
    #                       -> "failed"

    try:
        runner = get_runner(experiment.algorithm)
        results = runner(experiment.parameters)
        db_experiment.black_scholes_price = results["black_scholes_price"]
        db_experiment.classical_mc_result = results["classical_mc_result"]
        db_experiment.quantum_mc_result   = results["quantum_mc_result"]
        db_experiment.error_classical     = results["error_classical"]
        db_experiment.error_quantum       = results["error_quantum"]
        db_experiment.status = "completed"
    except Exception as e:
        print(f"Experiment {db_experiment.id} failed: {e}")
        db_experiment.status = "failed"
    
    db.commit() # persists results
    db.refresh(db_experiment)
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