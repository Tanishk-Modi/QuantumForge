import math
import time
import numpy as np


def run(params: dict) -> dict:
    S0 = float(params["spot_price"])
    K = float(params["strike_price"])
    r = float(params["risk_free_rate"])
    sigma = float(params["volatility"])
    T = float(params["time_to_expiry"])
    n_steps = int(params["monitoring_dates"])
    n_paths = int(params["n_shots"])

    if n_steps <= 0:
        raise ValueError("monitoring_dates must be > 0")
    if n_paths <= 1:
        raise ValueError("n_shots must be > 1")

    start = time.time()
    dt = T / n_steps

    # Simulate GBM paths and use arithmetic average across monitoring dates.
    z = np.random.standard_normal((n_paths, n_steps))
    drift = (r - 0.5 * sigma * sigma) * dt
    diffusion = sigma * math.sqrt(dt) * z
    log_returns = drift + diffusion

    log_paths = np.log(S0) + np.cumsum(log_returns, axis=1)
    price_paths = np.exp(log_paths)

    avg_price = np.mean(price_paths, axis=1)
    payoffs = np.maximum(avg_price - K, 0.0)

    discount = math.exp(-r * T)
    price = discount * float(np.mean(payoffs))
    std_dev = discount * float(np.std(payoffs, ddof=1) / math.sqrt(n_paths))

    return {
        "price": round(price, 4),
        "std_dev": round(std_dev, 4),
        "n_samples": n_paths,
        "runtime_ms": round((time.time() - start) * 1000, 2),
    }