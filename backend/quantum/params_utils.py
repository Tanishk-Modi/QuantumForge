"""Safe parameter coercion for experiment runner configs."""

from __future__ import annotations

from typing import Any


def param_int(params: dict[str, Any], key: str, default: int) -> int:
    value = params.get(key)
    if value is None or value == "":
        return default
    return int(value)


def param_float(params: dict[str, Any], key: str, default: float) -> float:
    value = params.get(key)
    if value is None or value == "":
        return default
    return float(value)


def drop_none_values(params: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in params.items() if value is not None}


ALGORITHM_DEFAULTS: dict[str, dict[str, Any]] = {
    "HHL_CFD": {
        "mesh_source": "preset",
        "mesh_preset": "lid_cavity",
        "reynolds": 100.0,
        "density": 1.0,
        "lid_velocity": 1.0,
        "time_step": 0.0,
        "time_parameter": 1.0,
        "num_clock_qubits": 3,
        "n_shots": 1024,
        "simulator": "statevector_simulator",
        "execution_target": "local_sync",
    },
    "QMC_European": {
        "n_shots": 1024,
        "simulator": "aer_simulator",
    },
    "QMC_Asian": {
        "n_shots": 1024,
        "simulator": "aer_simulator",
    },
    "QMC_Basket": {
        "n_shots": 1024,
        "simulator": "aer_simulator",
    },
}


def normalize_runner_params(algorithm: str, params: dict[str, Any]) -> dict[str, Any]:
    """Merge algorithm defaults and omit null values before execution."""
    defaults = ALGORITHM_DEFAULTS.get(algorithm, {})
    cleaned = drop_none_values(params)
    return {**defaults, **cleaned}
