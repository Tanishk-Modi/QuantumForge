import math
import time

from qiskit import QuantumCircuit, transpile
from qiskit.primitives import StatevectorSampler
from qiskit_aer.primitives import SamplerV2 as AerSamplerV2
from qiskit_finance.circuit.library import LogNormalDistribution, EuropeanCallPricingObjective
from qiskit_algorithms import IterativeAmplitudeEstimation, EstimationProblem

C_APPROX = 0.25
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


def _asian_average_moments(params: dict) -> tuple[float, float]:
    """
    Moment-match the arithmetic average A = (1 / n) * sum_i S(t_i)
    under risk-neutral GBM to a single lognormal random variable.

    This is an approximation. It is far cheaper than encoding the full
    path register and is appropriate for the current MVP architecture.
    """
    spot = float(params.get("spot_price", params.get("stock_price")))
    r = float(params["risk_free_rate"])
    sigma = float(params["volatility"])
    maturity = float(params["time_to_expiry"])
    n_steps = int(params["monitoring_dates"])

    if n_steps <= 0:
        raise ValueError("monitoring_dates must be > 0")

    times = [maturity * (index + 1) / n_steps for index in range(n_steps)]

    first_moment = 0.0
    for time_point in times:
        first_moment += spot * math.exp(r * time_point)
    first_moment /= n_steps

    second_moment = 0.0
    for time_i in times:
        for time_j in times:
            min_time = min(time_i, time_j)
            second_moment += (
                spot**2
                * math.exp(r * (time_i + time_j) + sigma**2 * min_time)
            )
    second_moment /= n_steps**2

    variance = max(second_moment - first_moment**2, 1e-12)
    return first_moment, variance


def _build_problem(params: dict):
    strike = float(params["strike_price"])
    r = float(params["risk_free_rate"])
    maturity = float(params["time_to_expiry"])
    num_qubits = int(params["num_uncertainty_qubits"])

    mean_average, variance_average = _asian_average_moments(params)

    log_variance = math.log(1.0 + variance_average / (mean_average**2))
    log_mean = math.log(mean_average) - 0.5 * log_variance
    stddev_average = math.sqrt(variance_average)

    low = max(0.0, mean_average - 3.0 * stddev_average)
    high = mean_average + 3.0 * stddev_average

    distribution = LogNormalDistribution(
        num_qubits,
        mu=log_mean,
        sigma=log_variance,
        bounds=(low, high),
    )

    objective = EuropeanCallPricingObjective(
        num_state_qubits=num_qubits,
        strike_price=strike,
        rescaling_factor=C_APPROX,
        bounds=(low, high),
    )

    circuit = QuantumCircuit(objective.num_qubits)
    circuit.compose(distribution, qubits=list(range(num_qubits)), inplace=True)
    circuit.compose(objective, inplace=True)

    problem = EstimationProblem(
        state_preparation=circuit,
        objective_qubits=[num_qubits],
        post_processing=objective.post_processing,
    )

    return problem, circuit, r, maturity


def _select_sampler(params: dict):
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
    problem, circuit, r, maturity = _build_problem(params)
    sampler, simulator_used, shots_used, seed_used = _select_sampler(params)

    iae = IterativeAmplitudeEstimation(
        epsilon_target=0.01,
        alpha=0.05,
        sampler=sampler,
    )

    start = time.time()
    result = iae.estimate(problem)
    runtime_ms = (time.time() - start) * 1000

    discount = math.exp(-r * maturity)
    price = discount * result.estimation_processed
    confidence_interval = result.confidence_interval_processed
    ci_low = discount * confidence_interval[0]
    ci_high = discount * confidence_interval[1]

    return {
        "price": round(float(price), 4),
        "confidence_interval_low": round(float(ci_low), 4),
        "confidence_interval_high": round(float(ci_high), 4),
        "circuit_depth": circuit.decompose().decompose().depth(),
        "qubit_count": circuit.num_qubits,
        "runtime_ms": round(runtime_ms, 2),
        "simulator_used": simulator_used,
        "shots_used": shots_used,
        "seed_used": seed_used,
    }