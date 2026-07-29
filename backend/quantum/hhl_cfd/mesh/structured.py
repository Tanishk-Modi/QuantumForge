"""Structured 2D quad mesh generation for preset flow domains."""

from __future__ import annotations

import numpy as np


def build_structured_mesh(nx: int, ny: int, x0: float, x1: float, y0: float, y1: float) -> dict:
    """Build a structured quad mesh with nx x ny cells."""
    x_nodes = np.linspace(x0, x1, nx + 1)
    y_nodes = np.linspace(y0, y1, ny + 1)

    nodes = []
    for j in range(ny + 1):
        for i in range(nx + 1):
            nodes.append([float(x_nodes[i]), float(y_nodes[j])])
    nodes = np.asarray(nodes, dtype=float)

    cells = []
    cell_centers = []
    for j in range(ny):
        for i in range(nx):
            n0 = j * (nx + 1) + i
            n1 = n0 + 1
            n2 = n0 + (nx + 1) + 1
            n3 = n0 + (nx + 1)
            cells.append([n0, n1, n2, n3])
            cx = 0.25 * (nodes[n0, 0] + nodes[n1, 0] + nodes[n2, 0] + nodes[n3, 0])
            cy = 0.25 * (nodes[n0, 1] + nodes[n1, 1] + nodes[n2, 1] + nodes[n3, 1])
            cell_centers.append([cx, cy])

    dx = (x1 - x0) / nx
    dy = (y1 - y0) / ny

    boundaries = {
        "bottom": _edge_cells(nx, ny, "bottom"),
        "top": _edge_cells(nx, ny, "top"),
        "left": _edge_cells(nx, ny, "left"),
        "right": _edge_cells(nx, ny, "right"),
    }

    return {
        "nodes": nodes,
        "cells": np.asarray(cells, dtype=int),
        "cell_centers": np.asarray(cell_centers, dtype=float),
        "nx": nx,
        "ny": ny,
        "dx": dx,
        "dy": dy,
        "bounds": {"xmin": x0, "xmax": x1, "ymin": y0, "ymax": y1},
        "boundary_names": list(boundaries.keys()),
        "boundaries": boundaries,
    }


def _edge_cells(nx: int, ny: int, edge: str) -> list[int]:
    if edge == "bottom":
        return list(range(nx))
    if edge == "top":
        return list(range(nx * (ny - 1), nx * ny))
    if edge == "left":
        return [j * nx for j in range(ny)]
    return [(j + 1) * nx - 1 for j in range(ny)]


def lid_cavity_mesh(cells_per_side: int = 8) -> dict:
    mesh = build_structured_mesh(cells_per_side, cells_per_side, 0.0, 1.0, 0.0, 1.0)
    mesh["preset"] = "lid_cavity"
    mesh["boundary_types"] = {
        "bottom": "wall",
        "top": "moving_lid",
        "left": "wall",
        "right": "wall",
    }
    return mesh


def channel_mesh(nx: int = 16, ny: int = 4) -> dict:
    mesh = build_structured_mesh(nx, ny, 0.0, 4.0, 0.0, 1.0)
    mesh["preset"] = "channel"
    mesh["boundary_types"] = {
        "bottom": "wall",
        "top": "wall",
        "left": "inflow",
        "right": "outflow",
    }
    return mesh
