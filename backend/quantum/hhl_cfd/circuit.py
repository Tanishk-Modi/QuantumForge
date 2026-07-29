"""HHL execution with local simulators and optional IBM QPU path."""

from __future__ import annotations

import time
from typing import Any

from qiskit import transpile
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
from qiskit_aer.primitives import SamplerV2 as AerSamplerV2
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as IBMSamplerV2

from database import Experiment, SessionLocal
from events import publish_experiment_event

from . import hhl_core
from .params_utils import param_int


def _publish_progress(experiment_id: int | None, event_type: str, data: dict[str, Any] | None = None) -> None:
    if experiment_id is None:
        return
    db = SessionLocal()
    try:
        experiment = db.query(Experiment).filter(Experiment.id == int(experiment_id)).first()
        if experiment:
            publish_experiment_event(db, experiment, event_type=event_type, data=data or {})
    finally:
        db.close()


class TranspilingIBMSampler:
    def __init__(self, backend, default_shots: int, experiment_id: int | None = None):
        self._default_shots = default_shots
        self._sampler = IBMSamplerV2(mode=backend)
        self._sampler.options.default_shots = default_shots
        self._pass_manager = generate_preset_pass_manager(backend=backend, optimization_level=1)
        self._experiment_id = experiment_id
        self._backend_name = backend.name

    def run(self, pubs):
        transpiled = []
        for pub in pubs:
            qc = pub[0] if isinstance(pub, tuple) else pub
            transpiled.append(self._pass_manager.run(qc))
        _publish_progress(
            self._experiment_id,
            "ibm_round_submitted",
            {"backend": self._backend_name, "shots": self._default_shots},
        )
        start = time.time()
        result = self._sampler.run(transpiled)
        _publish_progress(
            self._experiment_id,
            "ibm_round_completed",
            {"backend": self._backend_name, "duration_ms": (time.time() - start) * 1000},
        )
        return result


def run(problem: dict, params: dict) -> dict:
    execution_target = params.get("execution_target", "local_sync")
    system_size_n = problem["system_size_n"]
    experiment_id = params.get("experiment_id")

    if execution_target == "ibm_qpu":
        if system_size_n > 16:
            raise ValueError("IBM QPU HHL runs are limited to embedded system size n <= 16.")
        return _run_ibm(problem, params)

    return hhl_core.run_hhl(problem, params)


def _run_ibm(problem: dict, params: dict) -> dict:
    token = params.get("ibm_api_token")
    if not token:
        raise ValueError("ibm_api_token is required for IBM QPU execution.")

    experiment_id = params.get("experiment_id")
    n_shots = param_int(params, "n_shots", 1024)

    service = QiskitRuntimeService(channel="ibm_quantum_platform", token=token)
    backend = service.least_busy(operational=True, simulator=False)
    _publish_progress(
        experiment_id,
        "ibm_backend_selected",
        {"backend": backend.name, "shots": n_shots},
    )

    qc, state_reg, clock_reg, _, scaling_constant = hhl_core.build_hhl_circuit(problem, params)
    sampler = TranspilingIBMSampler(backend, n_shots, experiment_id=experiment_id)

    start = time.time()
    job = sampler.run([(qc,)])
    result = job.result()
    runtime_ms = (time.time() - start) * 1000

    # Fall back to statevector extraction for solution vector when IBM readout is unavailable
    statevector = hhl_core.simulate_statevector(qc, {**params, "simulator": "statevector_simulator"})
    solution = hhl_core.extract_solution(
        statevector,
        len(state_reg),
        len(clock_reg),
        problem["matrix"],
        problem["vector"],
        original_size=problem.get("original_size"),
    )

    return {
        "solution": solution.tolist(),
        "runtime_ms": round(runtime_ms, 4),
        "qubit_count": qc.num_qubits,
        "circuit_depth": qc.decompose(reps=5).depth(),
        "scaling_constant": round(scaling_constant, 6),
        "num_clock_qubits": len(clock_reg),
        "ibm_backend": backend.name,
        "n_shots": n_shots,
    }
