import numpy as np


def _make_condition_matrix(n: int, condition_number: float, sparsity: float, seed: int) -> np.ndarray:
    """
    Build a random sparse, symmetric positive-definite matrix A of size (n, n)
    with an approximate target condition number. HHL requires A to be Hermitian
    (symmetric for real matrices), so we build A = Q^T D Q where D holds
    eigenvalues spread between 1 and condition_number, and Q is orthogonal.
    """
    rng = np.random.default_rng(seed)

    eigenvalues = np.linspace(1.0, condition_number, n)

    random_matrix = rng.standard_normal((n, n))
    q, _ = np.linalg.qr(random_matrix)

    matrix = q @ np.diag(eigenvalues) @ q.T
    matrix = (matrix + matrix.T) / 2  # enforce symmetry against floating point drift

    mask = rng.random((n, n)) < sparsity
    mask = np.triu(mask, k=1)
    mask = mask + mask.T + np.eye(n, dtype=bool)
    matrix = matrix * mask

    # Re-symmetrize and nudge the diagonal to guarantee positive-definiteness
    matrix = (matrix + matrix.T) / 2
    matrix += np.eye(n) * 1e-3

    return matrix


def _make_rhs_vector(n: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed + 1)
    vector = rng.standard_normal(n)
    return vector / np.linalg.norm(vector)


def build_problem(params: dict) -> dict:
    """
    Construct the linear system Ax = b that both the classical solver and the
    quantum HHL circuit will solve, using shared parameters so comparisons are
    apples-to-apples.
    """
    n = int(params["system_size_n"])
    condition_number = float(params["condition_number"])
    sparsity = float(params["sparsity"])
    seed = int(params.get("rhs_seed", 42))

    matrix = _make_condition_matrix(n, condition_number, sparsity, seed)
    vector = _make_rhs_vector(n, seed)

    return {
        "matrix": matrix,
        "vector": vector,
        "system_size_n": n,
        "condition_number": condition_number,
        "sparsity": sparsity,
        "seed": seed,
    }