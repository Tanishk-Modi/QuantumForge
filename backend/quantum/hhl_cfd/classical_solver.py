import time
import numpy as np


def run(problem: dict) -> dict:
    """
    Solve Ax = b directly with a dense linear solver (NumPy). This is the
    classical baseline HHL is measured against - for small/simulated system
    sizes this is far faster than HHL on a simulator, which is expected; the
    interesting question is how the two runtimes scale as N and kappa grow.
    """
    matrix = problem["matrix"]
    vector = problem["vector"]

    start = time.time()
    solution = np.linalg.solve(matrix, vector)
    runtime_ms = (time.time() - start) * 1000

    residual = matrix @ solution - vector
    residual_norm = float(np.linalg.norm(residual))

    return {
        "solution": solution.tolist(),
        "residual_norm": round(residual_norm, 8),
        "runtime_ms": round(runtime_ms, 4),
        "system_size_n": problem["system_size_n"],
        "condition_number": problem["condition_number"],
    }