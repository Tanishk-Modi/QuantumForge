"""Boundary condition helpers for 2D Stokes FVM."""

from ..params_utils import param_float


def apply_boundary_conditions(
    mesh: dict,
    params: dict,
    n_cells: int,
) -> dict:
    """Return BC metadata used during matrix assembly."""
    density = param_float(params, "density", 1.0)
    reynolds = param_float(params, "reynolds", 100.0)
    lid_velocity = param_float(params, "lid_velocity", 1.0)

    viscosity_value = params.get("viscosity")
    if viscosity_value is None or viscosity_value == "":
        viscosity = density * lid_velocity / max(reynolds, 1.0)
    else:
        viscosity = float(viscosity_value)

    boundary_types = mesh.get("boundary_types", {})
    bc_cells: dict[str, list[int]] = {}

    for name, cell_indices in mesh.get("boundaries", {}).items():
        bc_type = boundary_types.get(name, "wall")
        bc_cells[name] = list(cell_indices)

    return {
        "density": density,
        "viscosity": viscosity,
        "reynolds": reynolds,
        "lid_velocity": lid_velocity,
        "bc_cells": bc_cells,
        "boundary_types": boundary_types,
        "n_cells": n_cells,
    }
