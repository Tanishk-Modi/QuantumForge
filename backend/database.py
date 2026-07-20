from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Text, create_engine
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

    parameters: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    # async execution fields
    task_id: Mapped[Optional[str]] = mapped_column(nullable=True, index=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # experiment result fields
    black_scholes_price: Mapped[Optional[float]] = mapped_column(nullable=True)
    classical_mc_result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quantum_mc_result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    circuit_image_path: Mapped[Optional[str]] = mapped_column(nullable=True)
    error_classical: Mapped[Optional[float]] = mapped_column(nullable=True)
    error_quantum: Mapped[Optional[float]] = mapped_column(nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()