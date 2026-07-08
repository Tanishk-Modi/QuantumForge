function ExperimentDetail({ experiment, onClose }) {

    const bs    = experiment.black_scholes_price
    const cmc   = experiment.classical_mc_result
    const qmc   = experiment.quantum_mc_result

    return (
        <div className="mt-8 border rounded-lg p-6">

            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-xl font-semibold">{experiment.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {experiment.algorithm} · {experiment.status} · {new Date(experiment.created_at).toLocaleString()}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="text-sm text-gray-400 hover:text-gray-600"
                >
                    ✕ Close
                </button>
            </div>

            {experiment.status === "failed" && (
                <p className="text-red-500">This experiment failed to run.</p>
            )}

            {experiment.status === "completed" && bs !== null && (
                <div className="grid grid-cols-3 gap-4">

                    {/* Black-Scholes */}
                    <div className="border rounded-lg p-4">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Black-Scholes</p>
                        <p className="text-2xl font-bold">${bs.toFixed(4)}</p>
                        <p className="text-xs text-gray-400 mt-1">Analytical ground truth</p>
                    </div>

                    {/* Classical MC */}
                    <div className="border rounded-lg p-4">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Classical MC</p>
                        <p className="text-2xl font-bold">${cmc.price.toFixed(4)}</p>
                        <p className="text-sm text-gray-500 mt-1">
                            Error: {(experiment.error_classical * 100).toFixed(2)}%
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            σ = {cmc.std_dev.toFixed(4)} · n = {cmc.n_samples.toLocaleString()}
                        </p>
                    </div>

                    {/* Quantum MC */}
                    <div className="border rounded-lg p-4">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Quantum MC</p>
                        <p className="text-2xl font-bold">${qmc.price.toFixed(4)}</p>
                        <p className="text-sm text-gray-500 mt-1">
                            Error: {(experiment.error_quantum * 100).toFixed(2)}%
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            CI: [{qmc.confidence_interval_low.toFixed(4)}, {qmc.confidence_interval_high.toFixed(4)}]
                        </p>
                        <p className="text-xs text-gray-400">
                            {qmc.qubit_count}q · depth {qmc.circuit_depth} · {qmc.runtime_ms.toFixed(0)}ms
                        </p>
                    </div>

                </div>
            )}

        </div>
    )
}

export default ExperimentDetail
