import { useEffect, useState } from 'react'
import apiClient from '../api/client'
import ExperimentList from '../ExperimentList'

function DashboardPage() {
  const [experiments, setExperiments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  async function fetchExperiments() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiClient.get('/api/experiments')
      setExperiments(response.data)
    } catch (err) {
      console.error(err)
      setError('Failed to fetch experiments.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchExperiments()
  }, [])

  const completedCount = experiments.filter(
    (experiment) => experiment.status === 'completed'
  ).length

  const failedCount = experiments.filter(
    (experiment) => experiment.status === 'failed'
  ).length

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Total Experiments</p>
          <p className="mt-2 text-3xl font-bold">{experiments.length}</p>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="mt-2 text-3xl font-bold text-green-600">
            {completedCount}
          </p>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-gray-500">Failed</p>
          <p className="mt-2 text-3xl font-bold text-red-600">
            {failedCount}
          </p>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">Experiment Registry</h2>
          <p className="text-sm text-gray-500">
            Browse all previously executed runs.
          </p>
        </div>

        <ExperimentList
          experiments={experiments}
          isLoading={isLoading}
          error={error}
          onDelete={fetchExperiments}
        />
      </section>
    </div>
  )
}

export default DashboardPage