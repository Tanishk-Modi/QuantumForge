"""
HHL (Harrow-Hassidim-Lloyd) linear solver circuit for the CFD benchmarking
algorithm. Given the classical system Ax = b built in problem.py, this module
constructs the HHL quantum circuit and extracts a numeric solution vector so
it can be compared against the classical direct solve.

Circuit structure (standard HHL):
  1. State-prepare |b> on the state register.
  2. Quantum Phase Estimation (QPE) of U = e^{iAt} onto the clock register,
     using controlled powers of U built from the classically-known matrix A.
  3. A uniformly-controlled RY rotation on an ancilla qubit, conditioned on
     the clock register's eigenvalue estimate, encoding 1/lambda into the
     ancilla's amplitude (the "reciprocal" step).
  4. Inverse QPE to disentangle/uncompute the clock register.
  5. Post-select on ancilla = 1 (and clock = 0) to read out a state
     proportional to the solution x = A^-1 b.

Known simplifications (documented rather than hidden):
  - Hamiltonian simulation uses an exact classical matrix exponential
    (scipy.linalg.expm) turned into a UnitaryGate, instead of a Trotterized
    circuit. This is standard for small-N teaching/benchmarking HHL
    implementations and keeps qubit/gate counts meaningful without
    implementing a general Hamiltonian simulation subroutine.
  - HHL naturally recovers x only up to an unknown global phase and scale.
    We remove the phase (rotate the dominant amplitude to be real/positive)
    and recover the scale via a least-squares fit against the known b vector
    (minimizing ||scale * A @ x_direction - b||). This turns the output state
    into a directly comparable numeric vector for the classical vs. quantum
    error metric.
  - Extraction uses the exact statevector (no shot sampling / tomography),
    since HHL's interesting quantity is the state it prepares, not repeated
    measurement statistics. n_shots and execution_target=ibm_qpu are not
    used by this circuit.
"""

import math
import time

import numpy as np
from scipy.linalg import expm

from qiskit import QuantumCircuit, QuantumRegister, transpile
from qiskit.circuit.library import QFT, UCRYGate, UnitaryGate
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator


def _num_state_qubits(system_size_n: int) -> int:
    return max(1, math.ceil(math.log2(system_size_n)))


def _eigenvalue_estimate(k: int, num_clock_qubits: int, evolution_time: float) -> float:
    """Maps a clock-register basis state k to the eigenvalue it represents."""
    return (2 * math.pi * k) / (2 ** num_clock_qubits * evolution_time)


def _reciprocal_scaling_constant(num_clock_qubits: int, evolution_time: float) -> float:
    """
    Choose C (the numerator in the conditional rotation C/lambda) as a safe
    fraction of the smallest nonzero eigenvalue the clock register can
    represent, so arcsin(C / lambda) stays within [-1, 1] for every estimate.
    """
    smallest_nonzero_estimate = _eigenvalue_estimate(1, num_clock_qubits, evolution_time)
    return 0.9 * smallest_nonzero_estimate


def _reciprocal_rotation_angles(num_clock_qubits: int, evolution_time: float, scaling_constant: float) -> list:
    """One RY rotation angle per clock-register basis state, encoding 1/lambda_k."""
    num_clock_states = 2 ** num_clock_qubits
    angles = [0.0]  # k = 0 carries no valid eigenvalue estimate; leave ancilla at |0>

    for k in range(1, num_clock_states):
        eigenvalue_estimate = _eigenvalue_estimate(k, num_clock_qubits, evolution_time)
        ratio = scaling_constant / eigenvalue_estimate if eigenvalue_estimate != 0 else 0.0
        ratio = max(-1.0, min(1.0, ratio))
        angles.append(2 * math.asin(ratio))

    return angles


def _build_hhl_circuit(problem: dict, params: dict):
    matrix = problem["matrix"]
    vector = problem["vector"]
    system_size_n = problem["system_size_n"]

    num_state_qubits = _num_state_qubits(system_size_n)
    num_clock_qubits = int(params.get("num_clock_qubits", 3))
    evolution_time = float(params.get("time_parameter", 1.0))

    state_reg = QuantumRegister(num_state_qubits, "state")
    clock_reg = QuantumRegister(num_clock_qubits, "clock")
    ancilla_reg = QuantumRegister(1, "ancilla")

    qc = QuantumCircuit(state_reg, clock_reg, ancilla_reg)

    # 1. Encode |b> into the state register
    qc.initialize(vector / np.linalg.norm(vector), state_reg)

    # 2. QPE of U = e^{iAt} onto the clock register
    qc.h(clock_reg)

    unitary = expm(1j * matrix * evolution_time)
    for k in range(num_clock_qubits):
        power = 2 ** k
        controlled_u = UnitaryGate(np.linalg.matrix_power(unitary, power)).control(1)
        qc.append(controlled_u, [clock_reg[k], *state_reg])

    qc.append(QFT(num_clock_qubits, inverse=True, do_swaps=True), clock_reg)

    # 3. Conditional reciprocal rotation onto the ancilla
    scaling_constant = _reciprocal_scaling_constant(num_clock_qubits, evolution_time)
    rotation_angles = _reciprocal_rotation_angles(num_clock_qubits, evolution_time, scaling_constant)
    qc.append(UCRYGate(rotation_angles), [ancilla_reg[0], *clock_reg])

    # 4. Uncompute the clock register (inverse QPE)
    qc.append(QFT(num_clock_qubits, inverse=False, do_swaps=True), clock_reg)

    for k in reversed(range(num_clock_qubits)):
        power = 2 ** k
        controlled_u_inv = UnitaryGate(np.linalg.matrix_power(unitary, power)).inverse().control(1)
        qc.append(controlled_u_inv, [clock_reg[k], *state_reg])

    qc.h(clock_reg)

    return qc, state_reg, clock_reg, ancilla_reg, scaling_constant


def _simulate_statevector(qc: QuantumCircuit, params: dict) -> np.ndarray:
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


def _extract_solution(
    statevector: np.ndarray,
    num_state_qubits: int,
    num_clock_qubits: int,
    matrix: np.ndarray,
    vector: np.ndarray,
) -> np.ndarray:
    """
    Post-select on ancilla = 1 and clock = 0 (the HHL success branch), then
    remove the unknown global phase and recover the unknown scale via a
    least-squares fit against b, so the result is directly comparable to the
    classical solution vector.
    """
    clock_start = num_state_qubits
    ancilla_index = num_state_qubits + num_clock_qubits
    num_clock_states = 2 ** num_clock_qubits
    num_state_states = 2 ** num_state_qubits

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
        return np.zeros(num_state_states)

    solution_direction = solution_direction / norm

    dominant_index = int(np.argmax(np.abs(solution_direction)))
    phase = solution_direction[dominant_index] / abs(solution_direction[dominant_index])
    solution_direction = (solution_direction / phase).real

    a_x = matrix @ solution_direction
    denominator = np.dot(a_x, a_x)
    scale = np.dot(a_x, vector) / denominator if denominator != 0 else 0.0

    return solution_direction * scale


def run(problem: dict, params: dict) -> dict:
    matrix = problem["matrix"]
    vector = problem["vector"]

    qc, state_reg, clock_reg, ancilla_reg, scaling_constant = _build_hhl_circuit(problem, params)

    start = time.time()
    statevector = _simulate_statevector(qc, params)
    runtime_ms = (time.time() - start) * 1000

    solution = _extract_solution(
        statevector, len(state_reg), len(clock_reg), matrix, vector
    )

    return {
        "solution": solution.tolist(),
        "runtime_ms": round(runtime_ms, 4),
        "qubit_count": qc.num_qubits,
        "circuit_depth": qc.decompose(reps=5).depth(),
        "scaling_constant": round(scaling_constant, 6),
        "num_clock_qubits": len(clock_reg),
    }