import { ResponsiveContainer, BarChart, CartesianGrid, Bar, XAxis, YAxis, Tooltip } from 'recharts'

function ExperimentDetail({ experiment, onClose }) {

    const bs    = experiment.black_scholes_price
    const cmc   = experiment.classical_mc_result
    const qmc   = experiment.quantum_mc_result

    // confidence interval stuff
    const ciLow = qmc.confidence_interval_low
    const ciHigh = qmc.confidence_interval_high
    const estimate = qmc.price

    const padding = (ciHigh - ciLow) * 0.25
    const scaleMin = Math.min(ciLow, estimate) - padding
    const scaleMax = Math.max(ciHigh, estimate) + padding
    const scaleRange = scaleMax - scaleMin

    const lowPercent = ((ciLow - scaleMin) / scaleRange) * 100
    const highPercent = ((ciHigh - scaleMin) / scaleRange) * 100
    const estimatePercent = ((estimate - scaleMin) / scaleRange) * 100
    const intervalWidth = highPercent - lowPercent

    let hasResults = experiment.status === "completed" && bs !== null && cmc && qmc
    let chartData = []

    if (hasResults) {
        chartData = [
            { name: "Black-Scholes", price: bs, fill: "#6b7280" },
            { name: "Classical MC", price: cmc.price, fill: "#16a34a" },
            { name: "Quantum MC", price: qmc.price, fill: "#2563eb" },
        ]
    }

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
                
                <div>

                    <div className='grid grid-cols-3 gap-4'>
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

                    <div className="mt-8 border rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-4">Price Comparison</h3>

                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart
                                data={chartData}
                                margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 12, fill: "#6b7280" }}
                                    axisLine={{ stroke: "#d1d5db" }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
                                    tick={{ fontSize: 12, fill: "#6b7280" }}
                                    axisLine={{ stroke: "#d1d5db" }}
                                    tickLine={false}
                                />
                                <Tooltip
                                    formatter={(value) => [`$${Number(value).toFixed(4)}`, "Price"]}
                                    contentStyle={{
                                        borderRadius: "8px",
                                        border: "1px solid #e5e7eb",
                                        fontSize: "14px",
                                    }}
                                />
                                <Bar
                                    dataKey="price"
                                    radius={[6, 6, 0, 0]}
                                    barSize={64}
                                    fill="#2563eb"
                                />
                            </BarChart>

                        </ResponsiveContainer>
                        
                        <div className="mt-8 border rounded-lg p-4">
                            <h3 className="text-lg font-semibold mb-4">Quantum Confidence Interval</h3>

                            <div className="relative h-14">
                                <div className="absolute top-1/2 left-0 w-full h-2 -translate-y-1/2 rounded-full bg-gray-200" />

                                <div
                                    className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-blue-200"
                                    style={{
                                        left: `${lowPercent}%`,
                                        width: `${intervalWidth}%`,
                                    }}
                                />

                                <div
                                    className="absolute top-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 border-2 border-white shadow"
                                    style={{ left: `${estimatePercent}%` }}
                                />

                                <div
                                    className="absolute top-full mt-2 -translate-x-1/2 text-xs text-gray-500"
                                    style={{ left: `${lowPercent}%` }}
                                >
                                    ${ciLow.toFixed(4)}
                                </div>

                                <div
                                    className="absolute top-full mt-2 -translate-x-1/2 text-xs font-medium text-blue-700"
                                    style={{ left: `${estimatePercent}%` }}
                                >
                                    ${estimate.toFixed(4)}
                                </div>

                                <div
                                    className="absolute top-full mt-2 -translate-x-1/2 text-xs text-gray-500"
                                    style={{ left: `${highPercent}%` }}
                                >
                                    ${ciHigh.toFixed(4)}
                                </div>
                            </div>

                            <p className="mt-8 text-sm text-gray-500">
                                The blue band shows the estimated confidence interval, and the dot marks the quantum estimate.
                            </p>
                        </div>

                    </div>

                </div>


            )}

        </div>
    )
}

export default ExperimentDetail
