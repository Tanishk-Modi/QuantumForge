"""Unified mesh loading from presets, uploads, or CGNS paths."""

from __future__ import annotations

from pathlib import Path

from .cgns_reader import read_cgns_mesh
from .presets import load_preset, preset_cgns_path


UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "meshes"


def load_mesh(params: dict) -> dict:
    mesh_source = params.get("mesh_source", "preset")

    if mesh_source == "preset":
        preset_id = params.get("mesh_preset", "lid_cavity")
        return load_preset(preset_id)

    if mesh_source == "upload":
        mesh_id = params.get("mesh_id")
        if not mesh_id:
            raise ValueError("mesh_id is required when mesh_source is 'upload'.")
        path = UPLOAD_DIR / f"{mesh_id}.cgns"
        mesh = read_cgns_mesh(path)
        mesh["mesh_source"] = "upload"
        mesh["mesh_id"] = mesh_id
        return mesh

    if mesh_source == "cgns_path":
        path = params.get("mesh_path")
        if not path:
            raise ValueError("mesh_path is required when mesh_source is 'cgns_path'.")
        mesh = read_cgns_mesh(path)
        mesh["mesh_source"] = "cgns_path"
        return mesh

    raise ValueError(f"Unsupported mesh_source: {mesh_source}")


def load_mesh_from_file(path: str | Path) -> dict:
    return read_cgns_mesh(path)


def mesh_summary(mesh: dict) -> dict:
    n_nodes = int(mesh["nodes"].shape[0])
    n_cells = int(mesh["cells"].shape[0])
    bounds = mesh.get("bounds", {})
    return {
        "node_count": n_nodes,
        "cell_count": n_cells,
        "system_size_n": 3 * n_cells,
        "bounds": bounds,
        "boundary_names": mesh.get("boundary_names", []),
        "mesh_source": mesh.get("mesh_source"),
        "mesh_preset": mesh.get("mesh_preset"),
        "mesh_id": mesh.get("mesh_id"),
    }


def estimate_system_size(params: dict) -> int:
    if params.get("system_size_n"):
        return int(params["system_size_n"])

    if params.get("mesh_source", "preset") == "preset":
        preset_id = params.get("mesh_preset", "lid_cavity")
        from .presets import PRESET_BUILDERS

        mesh = PRESET_BUILDERS[preset_id]()
        return 3 * mesh["cells"].shape[0]

    if params.get("mesh_id"):
        path = UPLOAD_DIR / f"{params['mesh_id']}.cgns"
        if path.exists():
            return 3 * read_cgns_mesh(path)["cells"].shape[0]

    return 0
