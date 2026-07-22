# PURPOSE: map algorithm string names to runner modules
from quantum.qmc_asian import runner as qmc_asian_runner
from quantum.qmc_basket import runner as qmc_basket_runner
from quantum.qmc_european import runner as qmc_european_runner
from quantum.hhl_cfd import runner as hhl_cfd_runner

REGISTRY = {
    "QMC_European": qmc_european_runner.run,
    "QMC_Asian": qmc_asian_runner.run,
    "QMC_Basket": qmc_basket_runner.run,
    "HHL_CFD": hhl_cfd_runner.run,
}


def get_runner(algorithm: str):
    if algorithm not in REGISTRY:
        raise ValueError(f"Unknown algorithm: {algorithm}")
    return REGISTRY[algorithm]