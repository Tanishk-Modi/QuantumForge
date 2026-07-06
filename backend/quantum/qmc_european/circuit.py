#encodes the lognormal distribution into a quantum state and uses quantum interference to estimate the #expected payoff

import math
import time
from qiskit_finance.circuit.library import LogNormalDistribution, EuropeanCallPricingObjective
from qiskit_algorithms import IterativeAmplitudeEstimation, EstimationProblem
from qiskit_aer.primitives import Sampler as AerSampler

def run(params: dict) -> dict:
    S         = params["stock_price"]
    K         = params["strike_price"]
    r         = params["risk_free_rate"]
    sigma     = params["volatility"]
    T         = params["time_to_expiry"]
    num_qubits = params["num_uncertainty_qubits"]

    # Bounds: 3 standard deviations of the lognormal distribution
    low  = S * math.exp((r - sigma**2 / 2) * T - 3 * sigma * math.sqrt(T))
    high = S * math.exp((r - sigma**2 / 2) * T + 3 * sigma * math.sqrt(T))

    mu               = math.log(S) + (r - sigma**2 / 2) * T
    sigma_lognormal  = sigma * math.sqrt(T)

    dist = LogNormalDistribution(
        num_qubits,
        mu=mu,
        sigma=sigma_lognormal,
        bounds=(low, high)
    )

    objective = EuropeanCallPricingObjective(
        num_state_qubits=num_qubits,
        strike_price=K,
        bounds=(low, high)
    )

    circuit = dist.compose(objective)

    problem = EstimationProblem(
        state_preparation=circuit,
        objective_qubits=[num_qubits]
    )

    sampler = AerSampler()
    iae = IterativeAmplitudeEstimation(epsilon_target=0.01, alpha=0.05, sampler=sampler)

    start = time.time()
    result = iae.estimate(problem)
    runtime_ms = (time.time() - start) * 1000

    estimated_price = result.estimation_processed * (high - low) + low
    price = math.exp(-r * T) * estimated_price

    ci = result.confidence_interval_processed
    ci_low  = math.exp(-r * T) * (ci[0] * (high - low) + low)
    ci_high = math.exp(-r * T) * (ci[1] * (high - low) + low)

    return {
        "price":                      round(float(price), 4),
        "confidence_interval_low":    round(float(ci_low), 4),
        "confidence_interval_high":   round(float(ci_high), 4),
        "circuit_depth":              circuit.decompose().depth(),
        "qubit_count":                circuit.num_qubits,
        "runtime_ms":                 round(runtime_ms, 2)
    }

