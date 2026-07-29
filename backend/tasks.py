import os
from datetime import datetime, timezone

from celery import Celery

from database import Experiment, SessionLocal
from events import publish_experiment_event
from quantum.params_utils import normalize_runner_params
from quantum.registry import get_runner

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

celery_app = Celery(
    "qforge_worker",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
)


@celery_app.task(name="run_experiment_task")
def run_experiment_task(experiment_id: int, ibm_api_token: str | None = None):
    db = SessionLocal()

    try:
        experiment = (
            db.query(Experiment)
            .filter(Experiment.id == experiment_id)
            .first()
        )

        if not experiment:
            raise ValueError(f"Experiment {experiment_id} not found.")

        if experiment.status == "completed":
            return {"experiment_id": experiment_id, "status": "completed"}

        experiment.status = "running"
        experiment.started_at = datetime.now(timezone.utc)
        experiment.error_message = None
        publish_experiment_event(
            db,
            experiment,
            event_type="status_running",
            data={"message": "Experiment execution started."},
        )

        params = normalize_runner_params(
            experiment.algorithm,
            {**dict(experiment.parameters), "experiment_id": experiment.id},
        )
        if ibm_api_token:
            params["ibm_api_token"] = ibm_api_token

        runner = get_runner(experiment.algorithm)
        results = runner(params)

        experiment.black_scholes_price = results["black_scholes_price"]
        experiment.classical_mc_result = results["classical_mc_result"]
        experiment.quantum_mc_result = results["quantum_mc_result"]
        experiment.error_classical = results["error_classical"]
        experiment.error_quantum = results["error_quantum"]
        experiment.status = "completed"
        experiment.finished_at = datetime.now(timezone.utc)
        experiment.error_message = None
        publish_experiment_event(
            db,
            experiment,
            event_type="status_completed",
            data={"message": "Experiment completed successfully."},
        )

        return {
            "experiment_id": experiment_id,
            "status": "completed",
        }

    except Exception as error:
        experiment = (
            db.query(Experiment)
            .filter(Experiment.id == experiment_id)
            .first()
        )

        if experiment:
            experiment.status = "failed"
            experiment.finished_at = datetime.now(timezone.utc)
            experiment.error_message = str(error)
            publish_experiment_event(
                db,
                experiment,
                event_type="status_failed",
                data={"message": "Experiment failed.", "error": str(error)},
            )

        raise

    finally:
        db.close()