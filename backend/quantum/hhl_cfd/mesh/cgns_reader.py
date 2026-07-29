"""CGNS mesh reader with pyCGNS primary path and h5py fallback."""

from __future__ import annotations

from pathlib import Path

import numpy as np


def read_cgns_mesh(path: str | Path) -> dict:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"CGNS mesh not found: {path}")

    try:
        return _read_with_pycgns(path)
    except ImportError:
        return _read_with_h5py(path)
    except Exception:
        return _read_with_h5py(path)


def _read_with_pycgns(path: Path) -> dict:
    import CGNS.MAP

    tree, _, _ = CGNS.MAP.load(str(path))
    return _parse_cgns_tree(tree)


def _read_with_h5py(path: Path) -> dict:
    import h5py

    with h5py.File(path, "r") as handle:
        base_names = [key for key in handle.keys() if key.startswith("Base")]
        if not base_names:
            raise ValueError("No CGNS Base node found in file.")

        base = handle[base_names[0]]
        zone_names = [key for key in base.keys() if key not in {"BaseIterativeData", "Family"}]
        if not zone_names:
            raise ValueError("No zone found in CGNS Base.")

        zone = base[zone_names[0]]
        coords = _read_zone_coordinates(zone)
        elements = _read_zone_elements(zone)
        boundaries = _read_zone_boundaries(zone, elements["cell_count"])

    nodes = np.column_stack([coords["x"], coords["y"]])
    cells = elements["connectivity"]
    cell_centers = nodes[cells].mean(axis=1)

    return {
        "nodes": nodes,
        "cells": cells,
        "cell_centers": cell_centers,
        "nx": None,
        "ny": None,
        "dx": None,
        "dy": None,
        "bounds": {
            "xmin": float(nodes[:, 0].min()),
            "xmax": float(nodes[:, 0].max()),
            "ymin": float(nodes[:, 1].min()),
            "ymax": float(nodes[:, 1].max()),
        },
        "boundary_names": list(boundaries.keys()),
        "boundaries": boundaries,
        "boundary_types": {name: "wall" for name in boundaries},
    }


def _read_zone_coordinates(zone) -> dict[str, np.ndarray]:
    grid = zone["GridCoordinates"]
    x = np.array(grid["CoordinateX"][" data"][...]).reshape(-1)
    y = np.array(grid["CoordinateY"][" data"][...]).reshape(-1)
    return {"x": x, "y": y}


def _read_zone_elements(zone) -> dict:
    section_names = [key for key in zone.keys() if key.startswith("ZoneElements")]
    if not section_names:
        raise ValueError("No ZoneElements section in CGNS zone.")

    section = zone[section_names[0]]
    connectivity = np.array(section["ElementConnectivity"][" data"][...], dtype=int)
    element_type = section.attrs.get("ElementType", b"QUAD_4")
    if isinstance(element_type, bytes):
        element_type = element_type.decode("ascii").strip("\x00")

    nodes_per_cell = 4 if "QUAD" in element_type else 3
    cell_count = connectivity.size // nodes_per_cell
    cells = connectivity.reshape(cell_count, nodes_per_cell) - 1
    return {"connectivity": cells, "cell_count": cell_count}


def _read_zone_boundaries(zone, cell_count: int) -> dict[str, list[int]]:
    boundaries: dict[str, list[int]] = {}
    for key in zone.keys():
        if not key.startswith("ZoneBC"):
            continue
        bc_node = zone[key]
        for bc_name in bc_node.keys():
            if bc_name in {" data", " type", " label"}:
                continue
            entry = bc_node[bc_name]
            point_list = entry.get("PointList")
            if point_list is None:
                continue
            raw = np.array(point_list[" data"][...], dtype=int).reshape(-1)
            # CGNS PointList is 1-based cell indices
            indices = [int(v) - 1 for v in raw if 0 < v <= cell_count]
            boundaries[str(bc_name)] = indices
    return boundaries


def _parse_cgns_tree(tree) -> dict:
    # pyCGNS tree: list nodes [name, value, children, type]
    base = _find_child(tree, "Base")
    zone = _find_zone(base)
    coords = _coords_from_tree(zone)
    cells, cell_count = _elements_from_tree(zone)
    boundaries = _boundaries_from_tree(zone, cell_count)

    nodes = np.column_stack([coords["x"], coords["y"]])
    cell_centers = nodes[cells].mean(axis=1)

    return {
        "nodes": nodes,
        "cells": cells,
        "cell_centers": cell_centers,
        "nx": None,
        "ny": None,
        "dx": None,
        "dy": None,
        "bounds": {
            "xmin": float(nodes[:, 0].min()),
            "xmax": float(nodes[:, 0].max()),
            "ymin": float(nodes[:, 1].min()),
            "ymax": float(nodes[:, 1].max()),
        },
        "boundary_names": list(boundaries.keys()),
        "boundaries": boundaries,
        "boundary_types": {name: "wall" for name in boundaries},
    }


def _find_child(node, name_prefix: str):
    for child in node[2]:
        if child[0].startswith(name_prefix):
            return child
    raise ValueError(f"CGNS node '{name_prefix}' not found.")


def _find_zone(base):
    for child in base[2]:
        if child[0].startswith("Zone"):
            return child
    raise ValueError("CGNS Zone not found.")


def _coords_from_tree(zone) -> dict[str, np.ndarray]:
    grid = _find_child(zone, "GridCoordinates")
    x = np.array(_find_child(grid, "CoordinateX")[1]).reshape(-1)
    y = np.array(_find_child(grid, "CoordinateY")[1]).reshape(-1)
    return {"x": x, "y": y}


def _elements_from_tree(zone):
    section = _find_child(zone, "ZoneElements")
    connectivity = np.array(section[1], dtype=int)
    cells = connectivity.reshape(-1, 4) - 1
    return cells, cells.shape[0]


def _boundaries_from_tree(zone, cell_count: int) -> dict[str, list[int]]:
    boundaries: dict[str, list[int]] = {}
    for child in zone[2]:
        if not child[0].startswith("ZoneBC"):
            continue
        for bc in child[2]:
            name = bc[0]
            point_list = _find_child(bc, "PointList")[1]
            indices = [int(v) - 1 for v in np.array(point_list).reshape(-1) if 0 < v <= cell_count]
            boundaries[name] = indices
    return boundaries
