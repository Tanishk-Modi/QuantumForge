"""Write simple 2D quad CGNS/HDF5 meshes for preset assets."""

from __future__ import annotations

from pathlib import Path

import h5py
import numpy as np


def write_quad_mesh_cgns(path: str | Path, mesh: dict) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    nodes = mesh["nodes"]
    cells = mesh["cells"] + 1  # CGNS 1-based
    n_nodes = nodes.shape[0]
    n_cells = cells.shape[0]

    with h5py.File(path, "w") as handle:
        base = handle.create_group("Base")
        base.attrs["label"] = np.bytes_(b"Base_t")
        base.attrs["name"] = np.bytes_(b"Base")

        zone = base.create_group("Zone")
        zone.attrs["label"] = np.bytes_(b"Zone_t")
        zone.attrs["name"] = np.bytes_(b"Flow")

        _write_coordinates(zone, nodes)
        _write_elements(zone, cells)
        _write_boundaries(zone, mesh.get("boundaries", {}))


def _write_coordinates(zone, nodes: np.ndarray) -> None:
    grid = zone.create_group("GridCoordinates")
    grid.attrs["label"] = np.bytes_(b"GridCoordinates_t")

    for axis, data in zip(("CoordinateX", "CoordinateY"), (nodes[:, 0], nodes[:, 1])):
        node = grid.create_group(axis)
        node.attrs["label"] = np.bytes_(b"DataArray_t")
        node.attrs["name"] = np.bytes_(axis.encode("ascii"))
        node.create_dataset(" data", data=data.astype(np.float64))


def _write_elements(zone, cells: np.ndarray) -> None:
    section = zone.create_group("ZoneElements")
    section.attrs["label"] = np.bytes_(b"Elements_t")
    section.attrs["name"] = np.bytes_(b"Quads")
    section.attrs["ElementType"] = np.bytes_(b"QUAD_4".ljust(32, b"\x00"))

    connectivity = section.create_group("ElementConnectivity")
    connectivity.attrs["label"] = np.bytes_(b"DataArray_t")
    connectivity.create_dataset(" data", data=cells.reshape(-1).astype(np.int32))


def _write_boundaries(zone, boundaries: dict[str, list[int]]) -> None:
    bc_root = zone.create_group("ZoneBC")
    bc_root.attrs["label"] = np.bytes_(b"ZoneBC_t")

    for name, cell_indices in boundaries.items():
        bc = bc_root.create_group(name)
        bc.attrs["label"] = np.bytes_(b"BC_t")
        bc.attrs["name"] = np.bytes_(name.encode("ascii")[:32].ljust(32, b"\x00"))

        point_list = bc.create_group("PointList")
        point_list.attrs["label"] = np.bytes_(b"IndexArray_t")
        point_list.create_dataset(" data", data=np.asarray(cell_indices, dtype=np.int32) + 1)
