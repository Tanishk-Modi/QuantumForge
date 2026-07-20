import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import apiClient from '../api/client'
import { getResultLabels, getSummaryFields, hasAnalyticalBaseline } from '../config/algorithms'

function ComparePage() {
  const [experiments, setExperiments] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [comparedExperiments, setComparedExperiments] = useState([])

  const [isLoadingExperiments, setIsLoadingExperiments] = useState(false)
  const [isComparing, setIsComparing] = useState(false)

  const [fetchError, setFetchError] = useState(null)
  const [compareError, setCompareError] = useState(null)

  useEffect(() => {
    async function fetchExperiments() {
      setIsLoadingExperiments(true)
      setFetchError(null)

      try {
        const response = await apiClient.get('/api/experiments')
        setExperiments(response.data)
      } catch (error) {
        console.error(error)
        setFetchError('Failed to load experiments.')
      } finally {
        setIsLoadingExperiments(false)
      }
    }

    fetchExperiments()
  }, [])

  const completedExperiments = useMemo(() => {
    return experiments.filter((experiment) => experiment.status === 'completed')
  }, [experiments])

  function handleToggleSelection(experimentId) {
    setCompareError(null)

    setSelectedIds((currentIds) => {
      if (currentIds.includes(experimentId)) {
        return currentIds.filter((id) => id !== experimentId)
      }

      if (currentIds.length >= 5) {
        setCompareError('You can compare at most 5 experiments at once.')
        return currentIds
      }

      return [...currentIds, experimentId]
    })
  }

  async function handleCompare() {
    if (selectedIds.length < 2) {
      setCompareError('Select at least 2 completed experiments.')
      setComparedExperiments([])
      return
    }

    setIsComparing(true)
    setCompareError(null)

    try {
      const response = await apiClient.get('/api/experiments/compare', {
        params: {
          ids: selectedIds.join(','),
        },
      })

      setComparedExperiments(response.data)
    } catch (error) {
      console.error(error)
      setComparedExperiments([])
      setCompareError(
        error.response?.data?.detail || 'Failed to compare experiments.'
      )
    } finally {
      setIsComparing(false)
    }
  }

  function clearComparison() {
    setSelectedIds([])
    setComparedExperiments([])
    setCompareError(null)
  }

  const algorithms = [...new Set(comparedExperiments.map((exp) => exp.algorithm))]
  const comparisonAlgorithm = algorithms[0] || null
  const showAnalyticalBaseline = hasAnalyticalBaseline(comparisonAlgorithm)
  const resultLabels = getResultLabels(comparisonAlgorithm)
  const summaryFields = getSummaryFields(comparisonAlgorithm)

  const priceChartData = comparedExperiments.map((experiment) => {
    const row = {
      name: experiment.name,
      classical: experiment.classical_mc_result?.price ?? null,
      quantum: experiment.quantum_mc_result?.price ?? null,
    }

    if (showAnalyticalBaseline) {
      row.analytical = experiment.black_scholes_price
    }

    return row
  })

  const errorChartData = comparedExperiments.map((experiment) => ({
    name: experiment.name,
    classicalError: experiment.error_classical
      ? experiment.error_classical * 100
      : 0,
    quantumError: experiment.error_quantum ? experiment.error_quantum * 100 : 0,
  }))

  function getExperimentSummary(experiment) {
    return getSummaryFields(experiment.algorithm).map(
      (field) => `${field.label}: ${experiment.parameters[field.name] ?? 'N/A'}`
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border bg-white p-6">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">Compare Experiments</h2>
          <p className="mt-1 text-sm text-gray-500">
            Select 2 to 5 completed runs and compare pricing, error, runtime,
            and circuit metrics side-by-side.
          </p>
        </div>

        {isLoadingExperiments && (
          <p className="text-gray-500">Loading experiments...</p>
        )}

        {fetchError && <p className="text-red-500">{fetchError}</p>}

        {!isLoadingExperiments && !fetchError && completedExperiments.length === 0 && (
          <p className="text-gray-500">
            There are no completed experiments available to compare yet.
          </p>
        )}

        {!isLoadingExperiments && !fetchError && completedExperiments.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-3">
              {completedExperiments.map((experiment) => {
                const isSelected = selectedIds.includes(experiment.id)

                return (
                  <label
                    key={experiment.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelection(experiment.id)}
                      className="mt-1"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <p className="font-medium">{experiment.name}</p>
                        <p className="text-sm text-gray-500">
                          ID {experiment.id} ·{' '}
                          {new Date(experiment.created_at).toLocaleString()}
                        </p>
                      </div>

                      <p className="mt-1 text-sm text-gray-500">
                        {experiment.algorithm}
                      </p>

                      <div className="mt-2 grid gap-2 text-sm text-gray-600 md:grid-cols-4">
                        {getExperimentSummary(experiment).map((summary, index) => (
                          <p key={index}>{summary}</p>
                        ))}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>

            {compareError && <p className="text-sm text-red-500">{compareError}</p>}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCompare}
                disabled={isComparing}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isComparing ? 'Comparing...' : 'Compare Selected Experiments'}
              </button>

              <button
                type="button"
                onClick={clearComparison}
                className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </section>

      {comparedExperiments.length > 0 && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-white p-5">
              <p className="text-sm text-gray-500">Compared Runs</p>
              <p className="mt-2 text-3xl font-bold">
                {comparedExperiments.length}
              </p>
            </div>

            <div className="rounded-lg border bg-white p-5">
              <p className="text-sm text-gray-500">Algorithm</p>
              <p className="mt-2 text-lg font-semibold">{comparisonAlgorithm}</p>
            </div>

            <div className="rounded-lg border bg-white p-5">
              <p className="text-sm text-gray-500">Best Quantum Error</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {Math.min(
                  ...comparedExperiments.map(
                    (experiment) => (experiment.error_quantum ?? 0) * 100
                  )
                ).toFixed(2)}
                %
              </p>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <div className="mb-5">
              <h3 className="text-xl font-semibold">Price Comparison</h3>
              <p className="text-sm text-gray-500">
                {showAnalyticalBaseline
                  ? `Compare the ${resultLabels.analytical} baseline against classical and quantum estimates for each run.`
                  : `Compare the ${resultLabels.classical} baseline against the ${resultLabels.quantum} estimate for each run.`}
              </p>
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={priceChartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
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
                  formatter={(value) => `$${Number(value).toFixed(4)}`}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                  }}
                />
                <Legend />
                {showAnalyticalBaseline && (
                  <Bar dataKey="analytical" name={resultLabels.analytical} fill="#6b7280" />
                )}
                <Bar dataKey="classical" name={resultLabels.classical} fill="#16a34a" />
                <Bar dataKey="quantum" name={resultLabels.quantum} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <div className="mb-5">
              <h3 className="text-xl font-semibold">Error Comparison</h3>
              <p className="text-sm text-gray-500">
                {showAnalyticalBaseline
                  ? `Lower percentages mean the estimate stayed closer to the ${resultLabels.analytical} reference.`
                  : `Lower percentages mean the estimate stayed closer to the ${resultLabels.classical} baseline.`}
              </p>
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={errorChartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#d1d5db' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#d1d5db' }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => `${Number(value).toFixed(2)}%`}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="classicalError"
                  name={`${resultLabels.classical} Error`}
                  fill="#16a34a"
                />
                <Bar
                  dataKey="quantumError"
                  name={`${resultLabels.quantum} Error`}
                  fill="#2563eb"
                />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <div className="mb-5">
              <h3 className="text-xl font-semibold">Detailed Metrics</h3>
              <p className="text-sm text-gray-500">
                This is the compact engineering view: inputs, runtime, and
                circuit characteristics in one place.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="px-3 py-3 font-medium">Experiment</th>
                    {summaryFields.map((field) => (
                      <th key={field.name} className="px-3 py-3 font-medium">
                        {field.label}
                      </th>
                    ))}
                    <th className="px-3 py-3 font-medium">{resultLabels.quantum} Price</th>
                    <th className="px-3 py-3 font-medium">CI Low</th>
                    <th className="px-3 py-3 font-medium">CI High</th>
                    <th className="px-3 py-3 font-medium">Qubits</th>
                    <th className="px-3 py-3 font-medium">Depth</th>
                    <th className="px-3 py-3 font-medium">Runtime</th>
                  </tr>
                </thead>

                <tbody>
                  {comparedExperiments.map((experiment) => {
                    const qmc = experiment.quantum_mc_result

                    return (
                      <tr key={experiment.id} className="border-b last:border-b-0">
                        <td className="px-3 py-3 font-medium">{experiment.name}</td>
                        {summaryFields.map((field) => (
                          <td key={field.name} className="px-3 py-3">
                            {experiment.parameters[field.name] ?? 'N/A'}
                          </td>
                        ))}
                        <td className="px-3 py-3">
                          {qmc?.price?.toFixed(4) ?? 'N/A'}
                        </td>
                        <td className="px-3 py-3">
                          {qmc?.confidence_interval_low?.toFixed(4) ?? 'N/A'}
                        </td>
                        <td className="px-3 py-3">
                          {qmc?.confidence_interval_high?.toFixed(4) ?? 'N/A'}
                        </td>
                        <td className="px-3 py-3">
                          {qmc?.qubit_count ?? 'N/A'}
                        </td>
                        <td className="px-3 py-3">
                          {qmc?.circuit_depth ?? 'N/A'}
                        </td>
                        <td className="px-3 py-3">
                          {qmc?.runtime_ms ? `${qmc.runtime_ms.toFixed(0)} ms` : 'N/A'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default ComparePage