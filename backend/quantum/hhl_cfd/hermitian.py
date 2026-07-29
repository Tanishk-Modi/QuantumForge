"""Embed non-Hermitian saddle-point system into Hermitian form for HHL."""

from __future__ import annotations

import numpy as np


def embed_hermitian(matrix: np.ndarray, vector: np.ndarray) -> dict:
    """
    Build H = [[0, A], [A.T, 0]] and padded RHS [b; 0].
    HHL on H yields solution x in the second block (A.T y1 = 0, A y2 = b).
    """
    n = matrix.shape[0]
    zero = np.zeros((n, n), dtype=float)
    hermitian = np.block([[zero, matrix], [matrix.T, zero]])
    padded_vector = np.zeros(2 * n, dtype=float)
    padded_vector[:n] = vector
    return {
        "matrix": hermitian,
        "vector": padded_vector,
        "original_size": n,
        "system_size_n": 2 * n,
    }


def extract_original_solution(embedded_solution: np.ndarray, original_size: int) -> np.ndarray:
    """Extract physical DOFs from the second block of the embedded solution."""
    vector = np.asarray(embedded_solution, dtype=float).reshape(-1)
    if vector.size >= 2 * original_size:
        return vector[original_size : 2 * original_size]
    return vector[:original_size]
