import numpy as np

from . import classical_solver, circuit
from .problem import build_problem


def run(params: dict) -> dict:
    problem = build_problem(params)

    classical_result = classical_solver.run(problem)
    quantum_result = circuit.run(problem, params)

    error_quantum = _relative_solution_error(
        quantum_result["solution"], classical_result["solution"]
    )

    return {
        # HHL has no closed-form analytical baseline - Ax=b is solved directly
        # (classical) or via HHL (quantum), so this stays None.
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