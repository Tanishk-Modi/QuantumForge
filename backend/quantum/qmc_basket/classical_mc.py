import math
import time
import numpy as np


def run(params: dict) -> dict:
    S1 = float(params["spot_price_1"])
    S2 = float(params["spot_price_2"])
    K = float(params["strike_price"])
    r = float(params["risk_free_rate"])
    T = float(params["time_to_expiry"])
    sigma1 = float(params["volatility_1"])
    sigma2 = float(params["volatility_2"])
    w1 = float(params["asset_weight_1"])
    w2 = float(params["asset_weight_2"])
    n_paths = int(params["n_shots"])

    # Optional correlation input; defaults to 0 for MVP.
    rho = float(params.get("correlation", 0.0))
    rho = max(-0.999, min(0.999, rho))

    if n_paths <= 1:
        raise ValueError("n_shots must be > 1")

    start = time.time()

    # Correlated standard normals via Cholesky.
    cov = np.array([[1.0, rho], [rho, 1.0]])
    L = np.linalg.cholesky(cov)
    z = np.random.standard_normal((n_paths, 2))
    z_corr = z @ L.T

    z1 = z_corr[:, 0]
    z2 = z_corr[:, 1]

    S1_T = S1 * np.exp((r - 0.5 * sigma1 * sigma1) * T + sigma1 * math.sqrt(T) * z1)
    S2_T = S2 * np.exp((r - 0.5 * sigma2 * sigma2) * T + sigma2 * math.sqrt(T) * z2)

    basket_terminal = w1 * S1_T + w2 * S2_T
    payoffs = np.maximum(basket_terminal - K, 0.0)

    discount = math.exp(-r * T)
    price = discount * float(np.mean(payoffs))
    std_dev = discount * float(np.std(payoffs, ddof=1) / math.sqrt(n_paths))

    return {
        "price": round(price, 4),
        "std_dev": round(std_dev, 4),
        "n_samples": n_paths,
        "runtime_ms": round((time.time() - start) * 1000, 2),
    }