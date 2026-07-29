"""Map solution vectors to per-cell velocity and pressure fields."""

from __future__ import annotations

import numpy as np


def fields_from_solution(solution: list | np.ndarray, mesh: dict, n_cells: int) -> dict:
    vector = np.asarray(solution, dtype=float).reshape(-1)
    u = vector[:n_cells]
    v = vector[n_cells : 2 * n_cells]
    p = vector[2 * n_cells : 3 * n_cells]
    centers = mesh["cell_centers"]
    velocity_magnitude = np.sqrt(u ** 2 + v ** 2)

    return {
        "x": centers[:, 0].tolist(),
        "y": centers[:, 1].tolist(),
        "u": u.tolist(),
        "v": v.tolist(),
        "p": p.tolist(),
        "velocity_magnitude": velocity_magnitude.tolist(),
    }


def mesh_summary(mesh: dict, n_cells: int) -> dict:
    return {
        "node_count": int(mesh["nodes"].shape[0]),
        "cell_count": n_cells,
        "mesh_source": mesh.get("mesh_source"),
        "mesh_preset": mesh.get("mesh_preset"),
        "mesh_id": mesh.get("mesh_id"),
    }
