import time

import numpy as np


def run(problem: dict) -> dict:
    matrix = problem.get("sparse_matrix")
    if matrix is None:
        import scipy.sparse as sp
        matrix = sp.csr_matrix(problem["original_matrix"])

    vector = problem["original_vector"]

    start = time.time()
    dense = matrix.toarray() if hasattr(matrix, "toarray") else np.asarray(matrix)
    solution, _, _, _ = np.linalg.lstsq(dense, vector, rcond=None)
    runtime_ms = (time.time() - start) * 1000

    residual = dense @ solution - vector
    residual_norm = float(np.linalg.norm(residual))

    original_size = problem.get("original_size", problem["system_size_n"])

    return {
        "solution": np.asarray(solution).tolist(),
        "residual_norm": round(residual_norm, 8),
        "runtime_ms": round(runtime_ms, 4),
        "system_size_n": original_size,
        "condition_number": problem["condition_number"],
    }
