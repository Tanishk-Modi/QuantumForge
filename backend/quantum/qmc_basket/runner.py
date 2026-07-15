import json

from . import classical_mc, circuit


def _relative_error(estimate: float, baseline: float) -> float:
    if abs(baseline) < 1e-12:
        return abs(estimate - baseline)
    return abs(estimate - baseline) / abs(baseline)


def run(params: dict) -> dict:
    classical_result = classical_mc.run(params)
    quantum_result = circuit.run(params)

    classical_price = classical_result["price"]
    quantum_price = quantum_result["price"]

    return {
        "black_scholes_price": None,
        "classical_mc_result": json.dumps(classical_result),
        "quantum_mc_result": json.dumps(quantum_result),
        "error_classical": 0.0,
        "error_quantum": _relative_error(quantum_price, classical_price),
    }