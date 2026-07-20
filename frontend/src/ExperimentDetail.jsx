import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import {
  getDisplayConfig,
  getResultLabels,
  hasAnalyticalBaseline,
} from './config/algorithms'

const STATUS_BANNER_STYLES = {
  queued: 'border-gray-200 bg-gray-50 text-gray-600',
  running: 'border-amber-200 bg-amber-50 text-amber-700',
}

const STATUS_BANNER_MESSAGES = {
  queued: 'This experiment is queued and waiting for a worker to pick it up.',
  running: 'This experiment is currently running in the background.',
}

function ExperimentDetail({ experiment }) {
  const analyticalResult = experiment.black_scholes_price
  const classicalResult = experiment.classical_mc_result
  const quantumResult = experiment.quantum_mc_result

  const display = getDisplayConfig(experiment.algorithm)
  const resultLabels = getResultLabels(experiment.algorithm)

  const showAnalyticalBaseline =
    hasAnalyticalBaseline(experiment.algorithm) &&
    analyticalResult !== null &&
    analyticalResult !== undefined

  const classicalValue = display.getClassicalValue(experiment)
  const quantumValue = display.getQuantumValue(experiment)

  const hasResults =
    experiment.status === 'completed' &&
    classicalResult &&
    quantumResult &&
    classicalValue !== null &&
    classicalValue !== undefined &&
    quantumValue !== null &&
    quantumValue !== undefined

  const ciConfig = display.confidenceInterval
  const hasConfidenceInterval =
    hasResults &&
    ciConfig?.enabled &&
    quantumResult?.[ciConfig.lowKey] !== undefined &&
    quantumResult?.[ciConfig.highKey] !== undefined &&
    quantumResult?.[ciConfig.estimateKey] !== undefined

  let chartData = []
  let ciLow = 0
  let ciHigh = 0
  let estimate = 0
  let lowPercent = 0
  let highPercent = 0
  let estimatePercent = 0
  let intervalWidth = 0

  if (hasResults) {
    chartData = showAnalyticalBaseline
      ? [
          {
            name: resultLabels.analytical,
            value: display.getAnalyticalValue(experiment),
            fill: '#6b7280',
          },
          {
            name: resultLabels.classical,
            value: classicalValue,
            fill: '#16a34a',
          },
          {
            name: resultLabels.quantum,
            value: quantumValue,
            fill: '#2563eb',
          },
        ]
      : [
          {
            name: resultLabels.classical,
            value: classicalValue,
            fill: '#16a34a',
          },
          {
            name: resultLabels.quantum,
            value: quantumValue,
            fill: '#2563eb',
          },
        ]
  }

  if (hasConfidenceInterval) {
    ciLow = quantumResult[ciConfig.lowKey]
    ciHigh = quantumResult[ciConfig.highKey]
    estimate = quantumResult[ciConfig.estimateKey]

    const padding = (ciHigh - ciLow) * 0.25
    const scaleMin = Math.min(ciLow, estimate) - padding
    const scaleMax = Math.max(ciHigh, estimate) + padding
    const scaleRange = scaleMax - scaleMin || 1

    lowPercent = ((ciLow - scaleMin) / scaleRange) * 100
    highPercent = ((ciHigh - scaleMin) / scaleRange) * 100
    estimatePercent = ((estimate - scaleMin) / scaleRange) * 100
    intervalWidth = highPercent - lowPercent
  }

  const classicalDetailLines = hasResults
    ? display.getClassicalDetailLines({
        experiment,
        classicalResult,
        quantumResult,
        resultLabels,
        showAnalyticalBaseline,
      })
    : []

  const quantumDetailLines = hasResults
    ? display.getQuantumDetailLines({
        experiment,
        classicalResult,
        quantumResult,
        resultLabels,
        showAnalyticalBaseline,
      })
    : []

  const classicalErrorText = hasResults
    ? display.getClassicalErrorText(experiment)
    : null

  const quantumErrorText = hasResults
    ? display.getQuantumErrorText(experiment)
    : null

  const isActiveStatus = experiment.status === 'queued' || experiment.status === 'running'

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

      {isActiveStatus && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-lg border p-4 text-sm ${STATUS_BANNER_STYLES[experiment.status]}`}
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
          <span>{STATUS_BANNER_MESSAGES[experiment.status]}</span>
        </div>
      )}

      {experiment.error_message && experiment.status === 'failed' && (
        <p className="mb-4 text-sm text-red-500">{experiment.error_message}</p>
      )}

      {experiment.status === 'failed' && (
        <p className="text-red-500">This experiment failed to run.</p>
      )}

      {!hasResults && experiment.status !== 'failed' && !isActiveStatus && (
        <p className="text-gray-500">
          This experiment does not have completed result data yet.
        </p>
      )}

      {hasResults && (
        <div>
          <div
            className={`grid gap-4 ${showAnalyticalBaseline ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}
          >
            {showAnalyticalBaseline && (
              <div className="rounded-lg border p-4">
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
                  {resultLabels.analytical}
                </p>
                <p className="text-2xl font-bold">
                  {display.formatValue(display.getAnalyticalValue(experiment), display.valueDecimals)}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Analytical ground truth
                </p>
              </div>
            )}

            <div className="rounded-lg border p-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
                {resultLabels.classical}
              </p>
              <p className="text-2xl font-bold">
                {display.formatValue(classicalValue, display.valueDecimals)}
              </p>
              {classicalErrorText && (
                <p className="mt-1 text-sm text-gray-500">{classicalErrorText}</p>
              )}
              {classicalDetailLines.map((line) => (
                <p key={line} className="mt-1 text-xs text-gray-400">
                  {line}
                </p>
              ))}
            </div>

            <div className="rounded-lg border p-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
                {resultLabels.quantum}
              </p>
              <p className="text-2xl font-bold">
                {display.formatValue(quantumValue, display.valueDecimals)}
              </p>
              {quantumErrorText && (
                <p className="mt-1 text-sm text-gray-500">{quantumErrorText}</p>
              )}
              {quantumDetailLines.map((line) => (
                <p key={line} className="mt-1 text-xs text-gray-400">
                  {line}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-lg border p-4">
            <h3 className="mb-4 text-lg font-semibold">{display.comparisonTitle}</h3>

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
                  tickFormatter={(value) => display.formatValue(Number(value), display.axisDecimals)}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#d1d5db' }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [
                    display.formatValue(Number(value), display.valueDecimals),
                    display.comparisonValueLabel,
                  ]}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  barSize={64}
                  fill="#2563eb"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {hasConfidenceInterval && (
            <div className="mt-8 rounded-lg border p-4">
              <h3 className="mb-4 text-lg font-semibold">
                {ciConfig.title}
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
                  {display.formatValue(ciLow, display.valueDecimals)}
                </div>

                <div
                  className="absolute top-full mt-2 -translate-x-1/2 text-xs font-medium text-blue-700"
                  style={{ left: `${estimatePercent}%` }}
                >
                  {display.formatValue(estimate, display.valueDecimals)}
                </div>

                <div
                  className="absolute top-full mt-2 -translate-x-1/2 text-xs text-gray-500"
                  style={{ left: `${highPercent}%` }}
                >
                  {display.formatValue(ciHigh, display.valueDecimals)}
                </div>
              </div>

              <p className="mt-8 text-sm text-gray-500">
                {ciConfig.description}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ExperimentDetail