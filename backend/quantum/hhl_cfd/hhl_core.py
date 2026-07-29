"""Core HHL circuit construction, simulation, and solution extraction."""

from __future__ import annotations

import math
import time

import numpy as np
from scipy.linalg import expm

from qiskit import QuantumCircuit, QuantumRegister, transpile
from qiskit.circuit.library import QFT, UCRYGate, UnitaryGate
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator

from .params_utils import param_float, param_int


def num_state_qubits(system_size_n: int) -> int:
    return max(1, math.ceil(math.log2(system_size_n)))


def _pad_to_qubit_dimension(matrix: np.ndarray, vector: np.ndarray) -> tuple[np.ndarray, np.ndarray, int]:
    n = matrix.shape[0]
    dim = 2 ** num_state_qubits(n)
    if dim == n:
        return matrix, vector, n

    padded_matrix = np.zeros((dim, dim), dtype=float)
    padded_matrix[:n, :n] = matrix
    padded_vector = np.zeros(dim, dtype=float)
    padded_vector[:n] = vector
    return padded_matrix, padded_vector, dim


def build_hhl_circuit(problem: dict, params: dict):
    matrix = np.asarray(problem["matrix"], dtype=float)
    vector = np.asarray(problem["vector"], dtype=float)
    if not problem.get("_skip_padding"):
        matrix, vector, system_size_n = _pad_to_qubit_dimension(matrix, vector)
    else:
        system_size_n = matrix.shape[0]

    num_sq = num_state_qubits(system_size_n)
    num_clock_qubits = param_int(params, "num_clock_qubits", 3)
    evolution_time = param_float(
        params,
        "time_parameter",
        param_float(params, "hamiltonian_time", 1.0),
    )

    state_reg = QuantumRegister(num_sq, "state")
    clock_reg = QuantumRegister(num_clock_qubits, "clock")
    ancilla_reg = QuantumRegister(1, "ancilla")

    qc = QuantumCircuit(state_reg, clock_reg, ancilla_reg)

    normalized = vector / np.linalg.norm(vector) if np.linalg.norm(vector) > 1e-12 else np.ones(len(vector)) / np.sqrt(len(vector))
    qc.initialize(normalized, state_reg)

    qc.h(clock_reg)
    unitary = expm(1j * matrix * evolution_time)
    for k in range(num_clock_qubits):
        power = 2 ** k
        controlled_u = UnitaryGate(np.linalg.matrix_power(unitary, power)).control(1)
        qc.append(controlled_u, [clock_reg[k], *state_reg])

    qc.append(QFT(num_clock_qubits, inverse=True, do_swaps=True), clock_reg)

    scaling_constant = _reciprocal_scaling_constant(num_clock_qubits, evolution_time)
    rotation_angles = _reciprocal_rotation_angles(num_clock_qubits, evolution_time, scaling_constant)
    qc.append(UCRYGate(rotation_angles), [ancilla_reg[0], *clock_reg])

    qc.append(QFT(num_clock_qubits, inverse=False, do_swaps=True), clock_reg)
    for k in reversed(range(num_clock_qubits)):
        power = 2 ** k
        controlled_u_inv = UnitaryGate(np.linalg.matrix_power(unitary, power)).inverse().control(1)
        qc.append(controlled_u_inv, [clock_reg[k], *state_reg])
    qc.h(clock_reg)

    return qc, state_reg, clock_reg, ancilla_reg, scaling_constant


def simulate_statevector(qc: QuantumCircuit, params: dict) -> np.ndarray:
    simulator = params.get("simulator", "aer_simulator")

    if simulator == "aer_simulator":
        circuit_with_save = qc.copy()
        circuit_with_save.save_statevector()
        backend = AerSimulator(method="statevector")
        transpiled = transpile(circuit_with_save, backend)
        result = backend.run(transpiled).result()
        return np.asarray(result.get_statevector(transpiled))

    if simulator == "statevector_simulator":
        return Statevector.from_instruction(qc).data

    raise ValueError("Unsupported simulator. Use 'aer_simulator' or 'statevector_simulator'.")


def extract_solution(
    statevector: np.ndarray,
    num_state_qubits_count: int,
    num_clock_qubits: int,
    matrix: np.ndarray,
    vector: np.ndarray,
    original_size: int | None = None,
) -> np.ndarray:
    clock_start = num_state_qubits_count
    ancilla_index = num_state_qubits_count + num_clock_qubits
    num_clock_states = 2 ** num_clock_qubits
    num_state_states = 2 ** num_state_qubits_count

    solution_direction = np.zeros(num_state_states, dtype=complex)

    for index, amplitude in enumerate(statevector):
        if (index >> ancilla_index) & 1 != 1:
            continue
        clock_value = (index >> clock_start) & (num_clock_states - 1)
        if clock_value != 0:
            continue
        state_value = index & (num_state_states - 1)
        solution_direction[state_value] += amplitude

    norm = np.linalg.norm(solution_direction)
    if norm == 0:
        target = original_size or matrix.shape[0]
        return np.zeros(target)

    solution_direction = solution_direction / norm
    dominant_index = int(np.argmax(np.abs(solution_direction)))
    phase = solution_direction[dominant_index] / abs(solution_direction[dominant_index])
    solution_direction = (solution_direction / phase).real

    stokes_size = original_size
    embedded_size = matrix.shape[0]

    if stokes_size is not None and embedded_size >= 2 * stokes_size:
        truncated = solution_direction[stokes_size : 2 * stokes_size].real
        sub_matrix = matrix[:stokes_size, stokes_size : 2 * stokes_size]
        sub_vector = vector[:stokes_size]
    else:
        target = stokes_size or embedded_size
        truncated = solution_direction[:target].real
        if truncated.size < target:
            padded = np.zeros(target)
            padded[: truncated.size] = truncated
            truncated = padded
        sub_matrix = matrix[:target, :target]
        sub_vector = vector[:target]

    a_x = sub_matrix @ truncated
    denominator = np.dot(a_x, a_x)
    scale = np.dot(a_x, sub_vector) / denominator if denominator != 0 else 0.0
    return truncated * scale


def run_hhl(problem: dict, params: dict) -> dict:
    matrix = np.asarray(problem["matrix"], dtype=float)
    vector = np.asarray(problem["vector"], dtype=float)
    stokes_size = problem["n_cells"] * 3
    matrix, vector, padded_size = _pad_to_qubit_dimension(matrix, vector)

    padded_problem = {
        **problem,
        "matrix": matrix,
        "vector": vector,
        "system_size_n": padded_size,
        "stokes_size": stokes_size,
    }

    qc, state_reg, clock_reg, _, scaling_constant = build_hhl_circuit(
        {**padded_problem, "_skip_padding": True}, params
    )

    start = time.time()
    statevector = simulate_statevector(qc, params)
    runtime_ms = (time.time() - start) * 1000

    solution = extract_solution(
        statevector,
        len(state_reg),
        len(clock_reg),
        matrix,
        vector,
        original_size=stokes_size,
    )

    return {
        "solution": solution.tolist(),
        "runtime_ms": round(runtime_ms, 4),
        "qubit_count": qc.num_qubits,
        "circuit_depth": qc.decompose(reps=5).depth(),
        "scaling_constant": round(scaling_constant, 6),
        "num_clock_qubits": len(clock_reg),
    }


def _eigenvalue_estimate(k: int, num_clock_qubits: int, evolution_time: float) -> float:
    return (2 * math.pi * k) / (2 ** num_clock_qubits * evolution_time)


def _reciprocal_scaling_constant(num_clock_qubits: int, evolution_time: float) -> float:
    smallest_nonzero_estimate = _eigenvalue_estimate(1, num_clock_qubits, evolution_time)
    return 0.9 * smallest_nonzero_estimate


def _reciprocal_rotation_angles(num_clock_qubits: int, evolution_time: float, scaling_constant: float) -> list:
    num_clock_states = 2 ** num_clock_qubits
    angles = [0.0]
    for k in range(1, num_clock_states):
        eigenvalue_estimate = _eigenvalue_estimate(k, num_clock_qubits, evolution_time)
        ratio = scaling_constant / eigenvalue_estimate if eigenvalue_estimate != 0 else 0.0
        ratio = max(-1.0, min(1.0, ratio))
        angles.append(2 * math.asin(ratio))
    return angles
