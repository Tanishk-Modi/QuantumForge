"""Mesh upload and preset API helpers."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from quantum.hhl_cfd.mesh.cgns_reader import read_cgns_mesh
from quantum.hhl_cfd.mesh.loader import UPLOAD_DIR, mesh_summary
from quantum.hhl_cfd.mesh.presets import ensure_preset_cgns_files, list_presets

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def save_uploaded_mesh(file: UploadFile) -> dict:
    filename = file.filename or ""
    if not filename.lower().endswith(".cgns"):
        raise HTTPException(status_code=400, detail="Only .cgns files are supported.")

    mesh_id = str(uuid.uuid4())
    target = UPLOAD_DIR / f"{mesh_id}.cgns"

    contents = await file.read()
    target.write_bytes(contents)

    try:
        mesh = read_cgns_mesh(target)
    except Exception as error:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Invalid CGNS mesh: {error}") from error

    summary = mesh_summary(mesh)
    summary["mesh_id"] = mesh_id
    return summary


def get_mesh_metadata(mesh_id: str, preview: bool = False) -> dict:
    path = UPLOAD_DIR / f"{mesh_id}.cgns"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Mesh not found.")

    mesh = read_cgns_mesh(path)
    summary = mesh_summary(mesh)
    summary["mesh_id"] = mesh_id

    if preview:
        nodes = mesh["nodes"]
        step = max(1, nodes.shape[0] // 200)
        summary["preview"] = {
            "nodes": nodes[::step].tolist(),
            "cell_centers": mesh["cell_centers"][::step].tolist(),
        }

    return summary


def get_preset_list() -> list[dict]:
    ensure_preset_cgns_files()
    return list_presets()
