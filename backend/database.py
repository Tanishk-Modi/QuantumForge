from sqlalchemy import create_engine, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from datetime import datetime, timezone
from typing import Optional

DATABASE_URL = "sqlite:///./qforge.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# produces new session object for each request
SessionLocal = sessionmaker(autocommit = False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(index=True)
    algorithm: Mapped[str] = mapped_column()
    status: Mapped[str] = mapped_column(default="queued")

    parameters: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    # qiskit finance stuff
    black_scholes_price:  Mapped[Optional[float]]
    classical_mc_result:  Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quantum_mc_result:    Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    circuit_image_path:   Mapped[Optional[str]]
    error_classical:      Mapped[Optional[float]]
    error_quantum:        Mapped[Optional[float]]

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
