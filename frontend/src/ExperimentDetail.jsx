import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

function ExperimentDetail({ experiment }) {
  const bs = experiment.black_scholes_price
  const cmc = experiment.classical_mc_result
  const qmc = experiment.quantum_mc_result

  const showAnalyticalBaseline = experiment.algorithm === 'QMC_European' && bs !== null
  const hasResults = experiment.status === 'completed' && cmc && qmc

  let chartData = []
  let ciLow = 0
  let ciHigh = 0
  let estimate = 0
  let lowPercent = 0
  let highPercent = 0
  let estimatePercent = 0
  let intervalWidth = 0

  if (hasResults) {
    ciLow = qmc.confidence_interval_low
    ciHigh = qmc.confidence_interval_high
    estimate = qmc.price

    const padding = (ciHigh - ciLow) * 0.25
    const scaleMin = Math.min(ciLow, estimate) - padding
    const scaleMax = Math.max(ciHigh, estimate) + padding
    const scaleRange = scaleMax - scaleMin

    lowPercent = ((ciLow - scaleMin) / scaleRange) * 100
    highPercent = ((ciHigh - scaleMin) / scaleRange) * 100
    estimatePercent = ((estimate - scaleMin) / scaleRange) * 100
    intervalWidth = highPercent - lowPercent

    chartData = showAnalyticalBaseline
      ? [
          { name: 'Black-Scholes', price: bs, fill: '#6b7280' },
          { name: 'Classical MC', price: cmc.price, fill: '#16a34a' },
          { name: 'Quantum MC', price: qmc.price, fill: '#2563eb' },
        ]
      : [
          { name: 'Classical MC', price: cmc.price, fill: '#16a34a' },
          { name: 'Quantum MC', price: qmc.price, fill: '#2563eb' },
        ]
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">{experiment.name}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {experiment.algorithm} · {experiment.status} ·{' '}
            {new Date(experiment.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      {experiment.status === 'failed' && (
        <p className="text-red-500">This experiment failed to run.</p>
      )}

      {!hasResults && experiment.status !== 'failed' && (
        <p className="text-gray-500">
          This experiment does not have completed result data yet.
        </p>
      )}

      {hasResults && (
        <div>
            <div className={`grid gap-4 ${showAnalyticalBaseline ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {showAnalyticalBaseline && (
              <div className="rounded-lg border p-4">
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
                  Black-Scholes
                </p>
                <p className="text-2xl font-bold">${bs.toFixed(4)}</p>
                <p className="mt-1 text-xs text-gray-400">
                  Analytical ground truth
                </p>
              </div>
            )}

            <div className="rounded-lg border p-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
                Classical MC
              </p>
              <p className="text-2xl font-bold">${cmc.price.toFixed(4)}</p>
              <p className="mt-1 text-sm text-gray-500">
                Error: {(experiment.error_classical * 100).toFixed(2)}%
              </p>
              <p className="mt-1 text-xs text-gray-400">
                σ = {cmc.std_dev.toFixed(4)} · n = {cmc.n_samples.toLocaleString()}
              </p>
              {!showAnalyticalBaseline && (
                <p className="mt-1 text-xs text-gray-400">
                  Simulation baseline for path-dependent / multi-asset pricing
                </p>
              )}
            </div>

            <div className="rounded-lg border p-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
                Quantum MC
              </p>
              <p className="text-2xl font-bold">${qmc.price.toFixed(4)}</p>
              <p className="mt-1 text-sm text-gray-500">
                Error: {(experiment.error_quantum * 100).toFixed(2)}%
              </p>
              <p className="mt-1 text-xs text-gray-400">
                CI: [{qmc.confidence_interval_low.toFixed(4)},{' '}
                {qmc.confidence_interval_high.toFixed(4)}]
              </p>
              <p className="text-xs text-gray-400">
                {qmc.qubit_count}q · depth {qmc.circuit_depth} ·{' '}
                {qmc.runtime_ms.toFixed(0)}ms
              </p>
              {!showAnalyticalBaseline && (
                <p className="mt-1 text-xs text-gray-400">
                  Error measured against Classical MC baseline
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-lg border p-4">
            <h3 className="mb-4 text-lg font-semibold">Price Comparison</h3>

            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#d1d5db' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#d1d5db' }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toFixed(4)}`, 'Price']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
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
          </div>

          <div className="mt-8 rounded-lg border p-4">
            <h3 className="mb-4 text-lg font-semibold">
              Quantum Confidence Interval
            </h3>

            <div className="relative h-14">
              <div className="absolute top-1/2 left-0 h-2 w-full -translate-y-1/2 rounded-full bg-gray-200" />

              <div
                className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-blue-200"
                style={{
                  left: `${lowPercent}%`,
                  width: `${intervalWidth}%`,
                }}
              />

              <div
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow"
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
              The blue band shows the estimated confidence interval, and the dot
              marks the quantum estimate.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExperimentDetail