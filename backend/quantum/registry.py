# PURPOSE: map algorithm string names to runner modules
from quantum.qmc_european import runner as qmc_european_runner

REGISTRY = {
    "QMC_European": qmc_european_runner.run
}

def get_runner(algorithm: str):
    if algorithm not in REGISTRY:
        raise ValueError(f"Uknown algorithm: {algorithm}")
    return REGISTRY[algorithm]