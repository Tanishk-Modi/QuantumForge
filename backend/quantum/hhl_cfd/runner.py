from __future__ import annotations

import numpy as np

from database import Experiment, SessionLocal
from events import publish_experiment_event

from . import circuit, classical_solver
from .postprocess import fields_from_solution, mesh_summary
from .problem import build_problem


def _publish(experiment_id: int | None, event_type: str, data: dict | None = None) -> None:
    if experiment_id is None:
        return
    db = SessionLocal()
    try:
        experiment = db.query(Experiment).filter(Experiment.id == int(experiment_id)).first()
        if experiment:
            publish_experiment_event(db, experiment, event_type=event_type, data=data or {})
    finally:
        db.close()


def run(params: dict) -> dict:
    experiment_id = params.get("experiment_id")
    _publish(experiment_id, "fvm_assembled", {"message": "Loading mesh and assembling FVM system."})

    problem = build_problem(params)
    n_cells = problem["n_cells"]
    mesh = problem["mesh"]

    _publish(
        experiment_id,
        "fvm_assembled",
        {
            "message": "FVM assembly complete.",
            "system_size_n": problem["system_size_n"],
            "condition_number": round(problem["condition_number"], 4),
        },
    )
    _publish(experiment_id, "hermitian_embedded", {"message": "Hermitian embedding applied for HHL."})

    classical_result = classical_solver.run(problem)
    quantum_result = circuit.run(problem, params)

    embedded_size = problem["system_size_n"]
    stokes_size = problem["n_cells"] * 3

    classical_physical = np.asarray(classical_result["solution"], dtype=float).reshape(-1)[:stokes_size]

    quantum_physical = np.asarray(quantum_result["solution"], dtype=float).reshape(-1)[:stokes_size]

    classical_fields = fields_from_solution(classical_physical, mesh, n_cells)
    quantum_fields = fields_from_solution(quantum_physical, mesh, n_cells)
    summary = mesh_summary(mesh, n_cells)

    classical_result["fields"] = classical_fields
    classical_result["mesh_summary"] = summary
    quantum_result["fields"] = quantum_fields
    quantum_result["mesh_summary"] = summary
    quantum_result["system_size_n"] = problem["system_size_n"]
    quantum_result["condition_number"] = problem["condition_number"]

    error_quantum = _relative_solution_error(quantum_physical, classical_physical)

    return {
        "black_scholes_price": None,
        "classical_mc_result": classical_result,
        "quantum_mc_result": quantum_result,
        "error_classical": classical_result["residual_norm"],
        "error_quantum": error_quantum,
    }


def _relative_solution_error(quantum_solution, classical_solution) -> float:
    quantum_vector = np.array(quantum_solution)
    classical_vector = np.array(classical_solution)
    denominator = np.linalg.norm(classical_vector)
    if denominator == 0:
        return 0.0
    return float(np.linalg.norm(quantum_vector - classical_vector) / denominator)
