from datetime import datetime, timezone
from typing import Literal, Optional, Union

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session

from database import Base, Experiment, engine, get_db, normalize_legacy_experiment_rows
from quantum.registry import get_runner
from tasks import run_experiment_task


app = FastAPI()
Base.metadata.create_all(bind=engine)
normalize_legacy_experiment_rows()

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

class ExperimentParameters(BaseModel):
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

    # HHL / CFD inputs
    system_size_n: Optional[int] = None
    condition_number: Optional[float] = None
    matrix_sparsity: Optional[float] = None
    target_precision: Optional[float] = None
    hamiltonian_time: Optional[float] = None
    num_clock_qubits: Optional[int] = None


class QueuedExperimentResponse(BaseModel):
    experiment_id: int
    task_id: str
    status: Literal["queued"]
    message: str


class ExperimentCreate(BaseModel):
    name: str
    algorithm: str
    parameters: ExperimentParameters


class ExperimentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    algorithm: str
    parameters: ExperimentParameters
    status: str
    created_at: datetime
    task_id: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None

    black_scholes_price: Optional[float] = None
    classical_mc_result: Optional[dict] = None
    quantum_mc_result: Optional[dict] = None
    error_classical: Optional[float] = None
    error_quantum: Optional[float] = None


# -- Helper Functions -- #

def should_queue_experiment(parameters: ExperimentParameters) -> bool:
    execution_target = parameters.execution_target
    num_qubits = parameters.num_uncertainty_qubits or 0

    return execution_target != "local_sync" or num_qubits > 5


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

@app.post(
    "/api/experiments",
    response_model=Union[ExperimentResponse, QueuedExperimentResponse],
)
def create_experiment(
    experiment: ExperimentCreate,
    response: Response,
    db: Session = Depends(get_db),
):
    ibm_api_token = experiment.parameters.ibm_api_token
    stored_params = experiment.parameters.model_dump(exclude={"ibm_api_token"})

    db_experiment = Experiment(
        name=experiment.name,
        algorithm=experiment.algorithm,
        parameters=stored_params,
        status="queued",
    )

    db.add(db_experiment)
    db.commit()
    db.refresh(db_experiment)

    if should_queue_experiment(experiment.parameters):
        try:
            task = run_experiment_task.delay(db_experiment.id, ibm_api_token)
            db_experiment.task_id = task.id
            db.commit()

            response.status_code = status.HTTP_202_ACCEPTED
            return QueuedExperimentResponse(
                experiment_id=db_experiment.id,
                task_id=task.id,
                status="queued",
                message="Experiment accepted and queued for background execution.",
            )
        except Exception as error:
            db_experiment.status = "failed"
            db_experiment.error_message = f"Failed to queue experiment: {error}"
            db_experiment.finished_at = datetime.now(timezone.utc)
            db.commit()
            raise HTTPException(
                status_code=503,
                detail="Failed to queue experiment.",
            ) from error

    db_experiment.status = "running"
    db_experiment.started_at = datetime.now(timezone.utc)
    db.commit()

    try:
        runner = get_runner(experiment.algorithm)
        results = runner(stored_params)

        db_experiment.black_scholes_price = results["black_scholes_price"]
        db_experiment.classical_mc_result = results["classical_mc_result"]
        db_experiment.quantum_mc_result = results["quantum_mc_result"]
        db_experiment.error_classical = results["error_classical"]
        db_experiment.error_quantum = results["error_quantum"]
        db_experiment.status = "completed"
        db_experiment.finished_at = datetime.now(timezone.utc)
        db_experiment.error_message = None
    except Exception as error:
        db_experiment.status = "failed"
        db_experiment.finished_at = datetime.now(timezone.utc)
        db_experiment.error_message = str(error)

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