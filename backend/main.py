import json
from datetime import datetime
from typing import Optional, Literal

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session

from database import Base, engine, get_db, Experiment
from quantum.registry import get_runner


app = FastAPI()
Base.metadata.create_all(bind=engine)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -- Pydantic Schemas -- #

class QMCParameters(BaseModel):
    model_config = ConfigDict(extra="allow")

    # execution metadata
    execution_target: Literal["local_sync", "background_worker", "ibm_qpu"] = "local_sync"
    ibm_api_token: Optional[str] = None

    # common pricing inputs
    strike_price: Optional[float] = None
    risk_free_rate: Optional[float] = None
    time_to_expiry: Optional[float] = None
    num_uncertainty_qubits: Optional[int] = None
    n_shots: Optional[int] = None
    simulator: Optional[Literal["aer_simulator", "statevector_simulator"]] = "aer_simulator"

    # European inputs
    stock_price: Optional[float] = None
    volatility: Optional[float] = None

    # Asian inputs
    spot_price: Optional[float] = None
    monitoring_dates: Optional[int] = None

    # Basket inputs
    spot_price_1: Optional[float] = None
    spot_price_2: Optional[float] = None
    volatility_1: Optional[float] = None
    volatility_2: Optional[float] = None
    asset_weight_1: Optional[float] = 0.5
    asset_weight_2: Optional[float] = 0.5
    correlation: Optional[float] = 0.0


class ExperimentCreate(BaseModel):
    name: str
    algorithm: str
    parameters: dict


class ExperimentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    algorithm: str
    parameters: QMCParameters
    status: str
    created_at: datetime

    black_scholes_price: Optional[float] = None
    classical_mc_result: Optional[dict] = None
    quantum_mc_result: Optional[dict] = None
    error_classical: Optional[float] = None
    error_quantum: Optional[float] = None

    @field_validator("parameters", mode="before")
    @classmethod
    def parse_parameters(cls, value):
        if isinstance(value, str):
            return json.loads(value)
        return value

    @field_validator("classical_mc_result", "quantum_mc_result", mode="before")
    @classmethod
    def parse_result_json(cls, value):
        if isinstance(value, str):
            return json.loads(value)
        return value


# -- Helper Functions -- #

def parse_compare_ids(ids: str) -> list[int]:
    raw_parts = [part.strip() for part in ids.split(",") if part.strip()]

    if len(raw_parts) < 2:
        raise HTTPException(
            status_code=400,
            detail="Provide at least 2 experiment IDs to compare.",
        )

    if len(raw_parts) > 5:
        raise HTTPException(
            status_code=400,
            detail="You can compare at most 5 experiments at once.",
        )

    try:
        parsed_ids = [int(part) for part in raw_parts]
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Experiment IDs must be integers.",
        )

    if len(set(parsed_ids)) != len(parsed_ids):
        raise HTTPException(
            status_code=400,
            detail="Duplicate experiment IDs are not allowed.",
        )

    return parsed_ids


def validate_compare_experiments(experiments: list[Experiment], requested_ids: list[int]) -> None:
    found_ids = {experiment.id for experiment in experiments}
    missing_ids = [experiment_id for experiment_id in requested_ids if experiment_id not in found_ids]

    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Experiment(s) not found: {missing_ids}",
        )

    incomplete_ids = [
        experiment.id for experiment in experiments if experiment.status != "completed"
    ]
    if incomplete_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Only completed experiments can be compared. Incomplete experiment IDs: {incomplete_ids}",
        )

    algorithms = {experiment.algorithm for experiment in experiments}
    if len(algorithms) > 1:
        raise HTTPException(
            status_code=400,
            detail="All compared experiments must use the same algorithm.",
        )


# -- Routes -- #

@app.post("/api/experiments", response_model=ExperimentResponse)
def create_experiment(experiment: ExperimentCreate, db: Session = Depends(get_db)):
    db_experiment = Experiment(
        name=experiment.name,
        algorithm=experiment.algorithm,
        parameters=json.dumps(experiment.parameters),
    )

    db.add(db_experiment)
    db.commit()
    db.refresh(db_experiment)

    db_experiment.status = "running"
    db.commit()

    try:
        runner = get_runner(experiment.algorithm)
        results = runner(experiment.parameters)

        db_experiment.black_scholes_price = results["black_scholes_price"]
        db_experiment.classical_mc_result = results["classical_mc_result"]
        db_experiment.quantum_mc_result = results["quantum_mc_result"]
        db_experiment.error_classical = results["error_classical"]
        db_experiment.error_quantum = results["error_quantum"]
        db_experiment.status = "completed"
    except Exception as error:
        print(f"Experiment {db_experiment.id} failed: {error}")
        db_experiment.status = "failed"

    db.commit()
    db.refresh(db_experiment)
    return db_experiment


@app.get("/api/experiments", response_model=list[ExperimentResponse])
def get_experiments(db: Session = Depends(get_db)):
    return db.query(Experiment).order_by(Experiment.created_at.desc()).all()


@app.get("/api/experiments/compare", response_model=list[ExperimentResponse])
def compare_experiments(
    ids: str = Query(..., description="Comma-separated experiment IDs, e.g. 1,2,3"),
    db: Session = Depends(get_db),
):
    parsed_ids = parse_compare_ids(ids)

    experiments = (
        db.query(Experiment)
        .filter(Experiment.id.in_(parsed_ids))
        .all()
    )

    validate_compare_experiments(experiments, parsed_ids)

    experiments_by_id = {experiment.id: experiment for experiment in experiments}
    ordered_experiments = [experiments_by_id[experiment_id] for experiment_id in parsed_ids]

    return ordered_experiments


@app.get("/api/experiments/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    db_experiment = (
        db.query(Experiment)
        .filter(Experiment.id == experiment_id)
        .first()
    )

    if not db_experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    return db_experiment


@app.delete("/api/experiments/{experiment_id}")
def delete_experiment(experiment_id: int, db: Session = Depends(get_db)):
    db_experiment = (
        db.query(Experiment)
        .filter(Experiment.id == experiment_id)
        .first()
    )

    if not db_experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    db.delete(db_experiment)
    db.commit()

    return {"ok": True}