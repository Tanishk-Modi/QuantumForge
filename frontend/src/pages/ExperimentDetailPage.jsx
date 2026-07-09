import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import apiClient from '../api/client'
import ExperimentDetail from '../ExperimentDetail'

function ExperimentDetailPage() {
  const { id } = useParams()

  const [experiment, setExperiment] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchExperiment() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await apiClient.get(`/api/experiments/${id}`)
        setExperiment(response.data)
      } catch (err) {
        console.error(err)

        if (err.response?.status === 404) {
          setError('Experiment not found.')
        } else {
          setError('Failed to fetch experiment.')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchExperiment()
  }, [id])

  if (isLoading) {
    return <p className="text-gray-500">Loading experiment...</p>
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <p className="text-red-500">{error}</p>
        <Link
          to="/"
          className="mt-4 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Dashboard
        </Link>
      </div>
    )
  }

  if (!experiment) {
    return null
  }

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        Back to Dashboard
      </Link>

      <ExperimentDetail experiment={experiment} />
    </div>
  )
}

export default ExperimentDetailPage