import math
import time
from qiskit import QuantumCircuit, transpile
from qiskit_aer.primitives import SamplerV2
from qiskit_finance.circuit.library import LogNormalDistribution, EuropeanCallPricingObjective
from qiskit_algorithms import IterativeAmplitudeEstimation, EstimationProblem

C_APPROX = 0.25  # linear approximation scaling factor

class TranspilingSampler:
    def __init__(self, default_shots: int = 100, seed: int = 75):
        self._sampler = SamplerV2(default_shots=default_shots, seed=seed)

    def run(self, pubs):
        transpiled_pubs = []

        for pub in pubs:
            circuit = pub[0] if isinstance(pub, tuple) else pub
            transpiled = transpile(circuit.decompose(reps=10), basis_gates=["u", "cx"])

            if isinstance(pub, tuple):
                transpiled_pubs.append((transpiled, *pub[1:]))
            else:
                transpiled_pubs.append(transpiled)

        return self._sampler.run(transpiled_pubs)

def run(params: dict) -> dict:
    S          = params["stock_price"]
    K          = params["strike_price"]
    r          = params["risk_free_rate"]
    sigma      = params["volatility"]
    T          = params["time_to_expiry"]
    num_qubits = params["num_uncertainty_qubits"]

    mu              = math.log(S) + (r - sigma**2 / 2) * T
    sigma_lognormal = sigma * math.sqrt(T)
    mean            = math.exp(mu + sigma_lognormal**2 / 2)
    variance        = (math.exp(sigma_lognormal**2) - 1) * math.exp(2 * mu + sigma_lognormal**2)
    stddev          = math.sqrt(variance)

    low  = max(0, mean - 3 * stddev)
    high = mean + 3 * stddev

    dist = LogNormalDistribution(
        num_qubits,
        mu=mu,
        sigma=sigma_lognormal**2,
        bounds=(low, high)
    )

    objective = EuropeanCallPricingObjective(
        num_state_qubits=num_qubits,
        strike_price=K,
        rescaling_factor=C_APPROX,
        bounds=(low, high)
    )

    # dist acts on first num_qubits qubits
    # objective acts on all qubits (state + ancilla + result)
    circuit = QuantumCircuit(objective.num_qubits)
    circuit.compose(dist, qubits=list(range(num_qubits)), inplace=True)
    circuit.compose(objective, inplace=True)

    problem = EstimationProblem(
        state_preparation=circuit,
        objective_qubits=[num_qubits],
        post_processing=objective.post_processing,
    )

    sampler = TranspilingSampler()
    iae = IterativeAmplitudeEstimation(epsilon_target=0.01, alpha=0.05, sampler=sampler)

    start = time.time()
    result = iae.estimate(problem)
    runtime_ms = (time.time() - start) * 1000

    # result.estimation_processed is now the expected undiscounted payoff in dollars
    price   = math.exp(-r * T) * result.estimation_processed
    ci      = result.confidence_interval_processed
    ci_low  = math.exp(-r * T) * ci[0]
    ci_high = math.exp(-r * T) * ci[1]

    return {
        "price":                    round(float(price), 4),
        "confidence_interval_low":  round(float(ci_low), 4),
        "confidence_interval_high": round(float(ci_high), 4),
        "circuit_depth":            circuit.decompose().decompose().depth(),
        "qubit_count":              circuit.num_qubits,
        "runtime_ms":               round(runtime_ms, 2)
    }