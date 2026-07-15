import math
import time

from qiskit import AncillaRegister, QuantumCircuit, QuantumRegister, transpile
from qiskit.circuit.library import LinearAmplitudeFunction, WeightedAdder
from qiskit.primitives import StatevectorSampler
from qiskit_aer.primitives import SamplerV2 as AerSamplerV2
from qiskit_algorithms import EstimationProblem, IterativeAmplitudeEstimation
from qiskit_finance.circuit.library import LogNormalDistribution

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


def _weighted_asset_distribution_params(spot, weight, rate, volatility, maturity):
    weighted_spot = spot * weight
    mu = math.log(weighted_spot) + (rate - 0.5 * volatility**2) * maturity
    sigma = volatility * math.sqrt(maturity)

    mean = math.exp(mu + sigma**2 / 2)
    variance = (math.exp(sigma**2) - 1) * math.exp(2 * mu + sigma**2)
    stddev = math.sqrt(variance)

    return mu, sigma, mean, variance, stddev


def _build_problem(params: dict):
    spot_1 = float(params["spot_price_1"])
    spot_2 = float(params["spot_price_2"])
    strike = float(params["strike_price"])
    rate = float(params["risk_free_rate"])
    maturity = float(params["time_to_expiry"])
    volatility_1 = float(params["volatility_1"])
    volatility_2 = float(params["volatility_2"])
    weight_1 = float(params.get("asset_weight_1", 0.5))
    weight_2 = float(params.get("asset_weight_2", 0.5))
    correlation = float(params.get("correlation", 0.0))
    num_uncertainty_qubits = int(params["num_uncertainty_qubits"])

    if weight_1 <= 0 or weight_2 <= 0:
        raise ValueError("asset weights must be positive for lognormal basket encoding")

    mu_1, sigma_1, mean_1, _, stddev_1 = _weighted_asset_distribution_params(
        spot_1, weight_1, rate, volatility_1, maturity
    )
    mu_2, sigma_2, mean_2, _, stddev_2 = _weighted_asset_distribution_params(
        spot_2, weight_2, rate, volatility_2, maturity
    )

    # Qiskit's basket construction assumes the same discretization step per dimension.
    # Use shared bounds across both weighted assets to keep the integer adder mapping valid.
    low_1 = max(0.0, mean_1 - 3.0 * stddev_1)
    low_2 = max(0.0, mean_2 - 3.0 * stddev_2)
    high_1 = mean_1 + 3.0 * stddev_1
    high_2 = mean_2 + 3.0 * stddev_2

    common_low = min(low_1, low_2)
    common_high = max(high_1, high_2)

    dimension = 2
    num_qubits = [num_uncertainty_qubits] * dimension
    lows = [common_low] * dimension
    highs = [common_high] * dimension

    covariance = [
        [sigma_1**2, correlation * sigma_1 * sigma_2],
        [correlation * sigma_1 * sigma_2, sigma_2**2],
    ]

    uncertainty_model = LogNormalDistribution(
        num_qubits=num_qubits,
        mu=[mu_1, mu_2],
        sigma=covariance,
        bounds=list(zip(lows, highs)),
    )

    weights = []
    for n_qubits in num_qubits:
        for bit_index in range(n_qubits):
            weights.append(2**bit_index)

    aggregator = WeightedAdder(sum(num_qubits), weights)
    num_sum_qubits = aggregator.num_sum_qubits
    num_adder_work_qubits = aggregator.num_qubits - aggregator.num_state_qubits - num_sum_qubits

    max_value = 2**num_sum_qubits - 1
    step_size = (common_high - common_low) / (2**num_uncertainty_qubits - 1)

    mapped_strike = (
        (strike - dimension * common_low)
        / (common_high - common_low)
        * (2**num_uncertainty_qubits - 1)
    )

    payoff_objective = LinearAmplitudeFunction(
        num_sum_qubits,
        slopes=[0, 1],
        offsets=[0, 0],
        domain=(0, max_value),
        image=(0, max_value - mapped_strike),
        rescaling_factor=C_APPROX,
        breakpoints=[0, mapped_strike],
    )

    work_qubits = max(num_adder_work_qubits, payoff_objective.num_ancillas)

    qr_state = QuantumRegister(uncertainty_model.num_qubits, "state")
    qr_obj = QuantumRegister(1, "obj")
    ar_sum = AncillaRegister(num_sum_qubits, "sum")

    registers = [qr_state, qr_obj, ar_sum]
    if work_qubits > 0:
        ar_work = AncillaRegister(work_qubits, "work")
        registers.append(ar_work)
    else:
        ar_work = []

    circuit = QuantumCircuit(*registers)
    circuit.append(uncertainty_model, qr_state)

    adder_qubits = list(qr_state) + list(ar_sum)
    if num_adder_work_qubits > 0:
        adder_qubits += list(ar_work[:num_adder_work_qubits])
    circuit.append(aggregator, adder_qubits)

    payoff_qubits = list(ar_sum) + list(qr_obj)
    if payoff_objective.num_ancillas > 0:
        payoff_qubits += list(ar_work[:payoff_objective.num_ancillas])
    circuit.append(payoff_objective, payoff_qubits)

    problem = EstimationProblem(
        state_preparation=circuit,
        objective_qubits=[uncertainty_model.num_qubits],
        post_processing=payoff_objective.post_processing,
    )

    return problem, circuit, rate, maturity, step_size


def _select_sampler(params: dict):
    simulator = params.get("simulator", "statevector_simulator")

    if simulator == "aer_simulator":
        shots = int(params.get("n_shots", DEFAULT_SHOTS))
        return TranspilingAerSampler(default_shots=shots), simulator, shots, DEFAULT_SEED

    if simulator == "statevector_simulator":
        return StatevectorSampler(), simulator, None, None

    raise ValueError("Unsupported simulator. Use 'aer_simulator' or 'statevector_simulator'.")


def run(params: dict) -> dict:
    problem, circuit, rate, maturity, step_size = _build_problem(params)
    sampler, simulator_used, shots_used, seed_used = _select_sampler(params)

    iae = IterativeAmplitudeEstimation(
        epsilon_target=0.01,
        alpha=0.05,
        sampler=sampler,
    )

    start = time.time()
    result = iae.estimate(problem)
    runtime_ms = (time.time() - start) * 1000

    discount = math.exp(-rate * maturity)

    # post_processing returns payoff in discretized index units; map back to price units
    price = discount * result.estimation_processed * step_size
    ci_low = discount * result.confidence_interval_processed[0] * step_size
    ci_high = discount * result.confidence_interval_processed[1] * step_size

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