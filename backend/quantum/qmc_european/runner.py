import json
from . import black_scholes, classical_mc, circuit

def run(params: dict) -> dict:
    bs_price = black_scholes.price_european_call(params)
    classical_price = classical_mc.run(params)
    quantum_price = circuit.run(params)

    # use black-scholes as baseline comparison
    error_classical = abs(classical_price["price"] - bs_price) / bs_price
    error_quantum = abs(quantum_price["price"] - bs_price) / bs_price

    return {
        "black_scholes_price":  bs_price,
        "classical_mc_result":  json.dumps(classical_price),
        "quantum_mc_result":    json.dumps(quantum_price),
        "error_classical":      error_classical,
        "error_quantum":        error_quantum,
    }