"""2D incompressible Stokes FVM discretization on structured quad meshes."""

from __future__ import annotations

import numpy as np
import scipy.sparse as sp

from .boundary_conditions import apply_boundary_conditions
from ..params_utils import param_float


def assemble_system(mesh: dict, params: dict) -> dict:
    nx = mesh["nx"]
    ny = mesh["ny"]
    if nx is None or ny is None:
        raise ValueError("FVM assembly currently requires structured quad meshes.")

    n_cells = nx * ny
    bc = apply_boundary_conditions(mesh, params, n_cells)
    mu = bc["viscosity"]
    dx = mesh["dx"]
    dy = mesh["dy"]
    time_step = param_float(params, "time_step", 0.0)

    n_dof = 3 * n_cells
    entries: dict[tuple[int, int], float] = {}
    rhs = np.zeros(n_dof, dtype=float)

    def u_idx(cell: int) -> int:
        return cell

    def v_idx(cell: int) -> int:
        return n_cells + cell

    def p_idx(cell: int) -> int:
        return 2 * n_cells + cell

    def add(row: int, col: int, value: float) -> None:
        entries[(row, col)] = entries.get((row, col), 0.0) + value

    def set_dirichlet(row: int, value: float) -> None:
        for key in list(entries):
            if key[0] == row:
                del entries[key]
        add(row, row, 1.0)
        rhs[row] = value

    set_dirichlet(p_idx(0), 0.0)

    coeff_x = mu / dx ** 2
    coeff_y = mu / dy ** 2
    lap_center = -(2 * coeff_x + 2 * coeff_y)

    for j in range(ny):
        for i in range(nx):
            cell = j * nx + i
            bc_u, bc_v = _cell_velocity_bc(cell, mesh, bc)
            is_interior = 0 < i < nx - 1 and 0 < j < ny - 1

            if bc_u is not None:
                set_dirichlet(u_idx(cell), bc_u)
            else:
                _add_laplacian(add, u_idx(cell), cell, nx, ny, lap_center, coeff_x, coeff_y)
                _add_dpdx(add, u_idx(cell), cell, nx, ny, p_idx, dx)

            if bc_v is not None:
                set_dirichlet(v_idx(cell), bc_v)
            else:
                _add_laplacian(add, v_idx(cell), cell, nx, ny, lap_center, coeff_x, coeff_y)
                _add_dpdy(add, v_idx(cell), cell, nx, ny, p_idx, dy)

            if is_interior:
                _add_divergence(add, p_idx(cell), cell, nx, ny, u_idx, v_idx, dx, dy)

    rows, cols, data = zip(*[(r, c, v) for (r, c), v in entries.items()])
    matrix = sp.csr_matrix((list(data), (list(rows), list(cols))), shape=(n_dof, n_dof))
    dense = matrix.toarray()

    if time_step > 0:
        mass_diag = np.tile([1.0, 1.0, 0.0], n_cells)
        dense = np.diag(mass_diag) / time_step + dense

    condition_number = _estimate_condition_number(dense)

    return {
        "matrix": dense,
        "vector": rhs,
        "sparse_matrix": sp.csr_matrix(dense),
        "system_size_n": n_dof,
        "condition_number": condition_number,
        "n_cells": n_cells,
        "mesh": mesh,
        "bc": bc,
    }


def _cell_velocity_bc(cell: int, mesh: dict, bc: dict):
    bc_u = bc_v = None
    boundary_types = bc["boundary_types"]
    priority = {"moving_lid": 3, "inflow": 3, "outflow": 2, "wall": 1}
    best = 0

    for name, indices in bc["bc_cells"].items():
        if cell not in indices:
            continue
        btype = boundary_types.get(name, "wall")
        rank = priority.get(btype, 0)
        if rank < best:
            continue
        best = rank
        if btype in {"moving_lid", "inflow"}:
            bc_u = bc["lid_velocity"]
            bc_v = 0.0
        elif btype == "wall":
            bc_u = 0.0
            bc_v = 0.0

    return bc_u, bc_v


def _neighbor(cell: int, di: int, dj: int, nx: int, ny: int) -> int:
    i = cell % nx + di
    j = cell // nx + dj
    if i < 0 or i >= nx or j < 0 or j >= ny:
        return cell
    return j * nx + i


def _add_laplacian(add, row, cell, nx, ny, center, coeff_x, coeff_y):
    add(row, row, center)
    add(row, _neighbor(cell, -1, 0, nx, ny), coeff_x)
    add(row, _neighbor(cell, 1, 0, nx, ny), coeff_x)
    add(row, _neighbor(cell, 0, -1, nx, ny), coeff_y)
    add(row, _neighbor(cell, 0, 1, nx, ny), coeff_y)


def _add_dpdx(add, row, cell, nx, ny, p_idx, dx):
    add(row, p_idx(_neighbor(cell, 1, 0, nx, ny)), 1.0 / (2 * dx))
    add(row, p_idx(_neighbor(cell, -1, 0, nx, ny)), -1.0 / (2 * dx))


def _add_dpdy(add, row, cell, nx, ny, p_idx, dy):
    add(row, p_idx(_neighbor(cell, 0, 1, nx, ny)), 1.0 / (2 * dy))
    add(row, p_idx(_neighbor(cell, 0, -1, nx, ny)), -1.0 / (2 * dy))


def _add_divergence(add, row, cell, nx, ny, u_idx, v_idx, dx, dy):
    add(row, u_idx(_neighbor(cell, 1, 0, nx, ny)), 1.0 / dx)
    add(row, u_idx(_neighbor(cell, -1, 0, nx, ny)), -1.0 / dx)
    add(row, v_idx(_neighbor(cell, 0, 1, nx, ny)), 1.0 / dy)
    add(row, v_idx(_neighbor(cell, 0, -1, nx, ny)), -1.0 / dy)


def _estimate_condition_number(matrix: np.ndarray) -> float:
    try:
        singular_values = np.linalg.svd(matrix, compute_uv=False)
        positive = singular_values[singular_values > 1e-10]
        if positive.size == 0:
            return 1.0
        return float(positive.max() / positive.min())
    except np.linalg.LinAlgError:
        return float("inf")
