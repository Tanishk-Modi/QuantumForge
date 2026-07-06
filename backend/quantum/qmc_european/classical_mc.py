import math
import time
import numpy as np

def run(params: dict) -> dict:
    S        = params["stock_price"]
    K        = params["strike_price"]
    r        = params["risk_free_rate"]
    sigma    = params["volatility"]
    T        = params["time_to_expiry"]
    n_shots  = params["n_shots"]

    start = time.time()

    Z    = np.random.standard_normal(n_shots)
    S_T  = S * np.exp((r - sigma**2 / 2) * T + sigma * math.sqrt(T) * Z)
    payoffs = np.maximum(S_T - K, 0)
    price   = math.exp(-r * T) * float(np.mean(payoffs))
    std_dev = float(np.std(payoffs) * math.exp(-r * T) / math.sqrt(n_shots))

    return {
        "price":      round(price, 4),
        "std_dev":    round(std_dev, 4),
        "n_samples":  n_shots,
        "runtime_ms": round((time.time() - start) * 1000, 2)
    }