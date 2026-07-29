"""Build FVM Stokes problem and Hermitian embedding for HHL."""

from __future__ import annotations

from .fvm.discretization import assemble_system
from .hermitian import embed_hermitian
from .mesh.loader import load_mesh


def build_problem(params: dict) -> dict:
    mesh = load_mesh(params)
    stokes = assemble_system(mesh, params)
    embedded = embed_hermitian(stokes["matrix"], stokes["vector"])

    return {
        **stokes,
        "matrix": embedded["matrix"],
        "vector": embedded["vector"],
        "original_matrix": stokes["matrix"],
        "original_vector": stokes["vector"],
        "sparse_matrix": stokes["sparse_matrix"],
        "original_size": embedded["original_size"],
        "system_size_n": embedded["system_size_n"],
        "mesh": mesh,
    }
