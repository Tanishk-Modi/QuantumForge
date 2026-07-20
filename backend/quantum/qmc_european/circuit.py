import math
import time
from qiskit import QuantumCircuit, transpile
from qiskit.primitives import StatevectorSampler
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
from qiskit_aer.primitives import SamplerV2 as AerSamplerV2
from qiskit_finance.circuit.library import LogNormalDistribution, EuropeanCallPricingObjective
from qiskit_algorithms import IterativeAmplitudeEstimation, EstimationProblem
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as IBMSamplerV2

C_APPROX = 0.25  # linear approximation scaling factor
DEFAULT_SEED = 75
DEFAULT_SHOTS = 1024


class TranspilingAerSampler:
    def __init__(self, default_shots: int, seed: int = DEFAULT_SEED):
        self._sampler = AerSamplerV2(default_shots=default_shots, seed=seed)

    def run(self, pubs):
        transpiled_pubs = []

        for pub in pubs:
            qc = pub[0] if isinstance(pub, tuple) else pub
            transpiled = transpile(qc.decompose(reps=10), basis_gates=["u", "cx"])

            if isinstance(pub, tuple):
                transpiled_pubs.append((transpiled, *pub[1:]))
            else:
                transpiled_pubs.append(transpiled)

        return self._sampler.run(transpiled_pubs)


class TranspilingIBMSampler:
    def __init__(self, backend, default_shots: int):
        self._default_shots = default_shots
        self._sampler = IBMSamplerV2(mode=backend)
        self._sampler.options.default_shots = default_shots
        self._pass_manager = generate_preset_pass_manager(backend=backend, optimization_level=1)

    def run(self, pubs):
        transpiled_pubs = []

        for pub in pubs:
            qc = pub[0] if isinstance(pub, tuple) else pub
            transpiled = self._pass_manager.run(qc.decompose(reps=10))

            if isinstance(pub, tuple):
                transpiled_pubs.append((transpiled, *pub[1:]))
            else:
                transpiled_pubs.append(transpiled)

        job = self._sampler.run(transpiled_pubs, shots=self._default_shots)
        return _ShotsPatchingJob(job, self._default_shots)


class _ShotsPatchingJob:
    """Wraps a RuntimeJobV2 so each pub result's metadata always has a
    'shots' key. qiskit_algorithms.IterativeAmplitudeEstimation reads
    result[i].metadata["shots"], but real-hardware SamplerV2 results on
    newer qiskit-ibm-runtime versions don't always populate that key.
    We already know the requested shot count, so we backfill it here
    instead of pinning to an old, Qiskit-incompatible runtime version.
    """

    def __init__(self, job, shots: int):
        self._job = job
        self._shots = shots

    def result(self):
        primitive_result = self._job.result()

        for pub_result in primitive_result:
            pub_result.metadata.setdefault("shots", self._shots)

        return primitive_result

    def __getattr__(self, name):
        return getattr(self._job, name)


def _build_problem(params: dict):
    S = params["stock_price"]
    K = params["strike_price"]
    r = params["risk_free_rate"]
    sigma = params["volatility"]
    T = params["time_to_expiry"]
    num_qubits = params["num_uncertainty_qubits"]

    mu = math.log(S) + (r - sigma**2 / 2) * T
    sigma_lognormal = sigma * math.sqrt(T)
    mean = math.exp(mu + sigma_lognormal**2 / 2)
    variance = (math.exp(sigma_lognormal**2) - 1) * math.exp(2 * mu + sigma_lognormal**2)
    stddev = math.sqrt(variance)

    low = max(0, mean - 3 * stddev)
    high = mean + 3 * stddev

    dist = LogNormalDistribution(
        num_qubits,
        mu=mu,
        sigma=sigma_lognormal**2,
        bounds=(low, high),
    )

    objective = EuropeanCallPricingObjective(
        num_state_qubits=num_qubits,
        strike_price=K,
        rescaling_factor=C_APPROX,
        bounds=(low, high),
    )

    qc = QuantumCircuit(objective.num_qubits)
    qc.compose(dist, qubits=list(range(num_qubits)), inplace=True)
    qc.compose(objective, inplace=True)

    problem = EstimationProblem(
        state_preparation=qc,
        objective_qubits=[num_qubits],
        post_processing=objective.post_processing,
    )

    return problem, qc, r, T


def _select_sampler(params: dict):
    if params.get("execution_target") == "ibm_qpu":
        token = params.get("ibm_api_token")
        if not token:
            raise ValueError("IBM API token is required for ibm_qpu execution.")

        service = QiskitRuntimeService(channel="ibm_quantum_platform", token=token)
        backend = service.least_busy(operational=True, simulator=False)
        shots = int(params.get("n_shots", DEFAULT_SHOTS))

        return TranspilingIBMSampler(backend, default_shots=shots), backend.name, shots, None

    simulator = params.get("simulator", "statevector_simulator")

    if simulator == "aer_simulator":
        shots = int(params.get("n_shots", DEFAULT_SHOTS))
        return TranspilingAerSampler(default_shots=shots), simulator, shots, DEFAULT_SEED

    if simulator == "statevector_simulator":
        return StatevectorSampler(), simulator, None, None

    raise ValueError(
        "Unsupported simulator. Use 'aer_simulator' or 'statevector_simulator'."
    )


def run(params: dict) -> dict:
    problem, qc, r, T = _build_problem(params)
    sampler, simulator_used, shots_used, seed_used = _select_sampler(params)

    iae = IterativeAmplitudeEstimation(
        epsilon_target=0.01,
        alpha=0.05,
        sampler=sampler,
    )

    start = time.time()
    result = iae.estimate(problem)
    runtime_ms = (time.time() - start) * 1000

    price = math.exp(-r * T) * result.estimation_processed
    ci = result.confidence_interval_processed
    ci_low = math.exp(-r * T) * ci[0]
    ci_high = math.exp(-r * T) * ci[1]

    return {
        "price": round(float(price), 4),
        "confidence_interval_low": round(float(ci_low), 4),
        "confidence_interval_high": round(float(ci_high), 4),
        "circuit_depth": qc.decompose().decompose().depth(),
        "qubit_count": qc.num_qubits,
        "runtime_ms": round(runtime_ms, 2),
        "simulator_used": simulator_used,
        "shots_used": shots_used,
        "seed_used": seed_used,
    }