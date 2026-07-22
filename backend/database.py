import json
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import JSON, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

DATABASE_URL = "sqlite:///./qforge.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(index=True)
    algorithm: Mapped[str] = mapped_column()
    status: Mapped[str] = mapped_column(default="queued", index=True)

    parameters: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    # async execution fields
    task_id: Mapped[Optional[str]] = mapped_column(nullable=True, index=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # durable event history for websocket catch-up
    progress_log: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)

    # experiment result fields
    black_scholes_price: Mapped[Optional[float]] = mapped_column(nullable=True)
    classical_mc_result: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    quantum_mc_result: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    circuit_image_path: Mapped[Optional[str]] = mapped_column(nullable=True)
    error_classical: Mapped[Optional[float]] = mapped_column(nullable=True)
    error_quantum: Mapped[Optional[float]] = mapped_column(nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def normalize_legacy_experiment_rows() -> None:
    db = SessionLocal()

    try:
        experiments = db.query(Experiment).all()
        did_change = False

        for experiment in experiments:
            if isinstance(experiment.parameters, str):
                try:
                    experiment.parameters = json.loads(experiment.parameters)
                    did_change = True
                except json.JSONDecodeError:
                    pass

            if isinstance(experiment.classical_mc_result, str):
                try:
                    experiment.classical_mc_result = json.loads(experiment.classical_mc_result)
                    did_change = True
                except json.JSONDecodeError:
                    pass

            if isinstance(experiment.quantum_mc_result, str):
                try:
                    experiment.quantum_mc_result = json.loads(experiment.quantum_mc_result)
                    did_change = True
                except json.JSONDecodeError:
                    pass

            # normalize historical rows to always expose a list
            if experiment.progress_log is None:
                experiment.progress_log = []
                did_change = True
            elif isinstance(experiment.progress_log, str):
                try:
                    parsed = json.loads(experiment.progress_log)
                    experiment.progress_log = parsed if isinstance(parsed, list) else []
                    did_change = True
                except json.JSONDecodeError:
                    experiment.progress_log = []
                    did_change = True

        if did_change:
            db.commit()
    finally:
        db.close()


def ensure_experiment_schema() -> None:
    """Apply lightweight SQLite schema patches needed by current ORM models."""
    with engine.begin() as connection:
        table_info_rows = connection.exec_driver_sql("PRAGMA table_info(experiments)").fetchall()
        existing_columns = {row[1] for row in table_info_rows}

        if "progress_log" not in existing_columns:
            connection.exec_driver_sql("ALTER TABLE experiments ADD COLUMN progress_log JSON")
            connection.exec_driver_sql("UPDATE experiments SET progress_log = '[]' WHERE progress_log IS NULL")