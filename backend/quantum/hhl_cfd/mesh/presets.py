"""Built-in flow mesh presets."""

from __future__ import annotations

from pathlib import Path

from .structured import channel_mesh, lid_cavity_mesh

PRESET_DIR = Path(__file__).resolve().parent.parent / "meshes"

PRESET_BUILDERS = {
    "lid_cavity": lambda: lid_cavity_mesh(cells_per_side=2),
    "channel": lambda: channel_mesh(nx=3, ny=2),
}

PRESET_LABELS = {
    "lid_cavity": "Lid-Driven Cavity (2×2)",
    "channel": "Channel Flow (3×2)",
}


def list_presets() -> list[dict]:
    return [
        {
            "id": preset_id,
            "label": PRESET_LABELS[preset_id],
            "estimated_dofs": _estimate_dofs(preset_id),
        }
        for preset_id in PRESET_BUILDERS
    ]


def load_preset(preset_id: str) -> dict:
    if preset_id not in PRESET_BUILDERS:
        raise ValueError(f"Unknown mesh preset: {preset_id}")
    mesh = PRESET_BUILDERS[preset_id]()
    mesh["mesh_source"] = "preset"
    mesh["mesh_preset"] = preset_id
    return mesh


def preset_cgns_path(preset_id: str) -> Path:
    return PRESET_DIR / f"{preset_id}.cgns"


def ensure_preset_cgns_files() -> None:
    PRESET_DIR.mkdir(parents=True, exist_ok=True)
    from .cgns_writer import write_quad_mesh_cgns

    for preset_id, builder in PRESET_BUILDERS.items():
        target = preset_cgns_path(preset_id)
        if not target.exists():
            write_quad_mesh_cgns(target, builder())


def _estimate_dofs(preset_id: str) -> int:
    mesh = PRESET_BUILDERS[preset_id]()
    n_cells = mesh["cells"].shape[0]
    return 3 * n_cells
