import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import apiClient from '../api/client'
import ExperimentDetail from '../ExperimentDetail'

const POLL_INTERVAL_MS = 3000
const ACTIVE_STATUSES = ['queued', 'running']

function ExperimentDetailPage() {
  const { id } = useParams()

  const [experiment, setExperiment] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const intervalRef = useRef(null)

  useEffect(() => {
    let isCancelled = false

    async function fetchExperiment({ showLoading }) {
      if (showLoading) {
        setIsLoading(true)
      }
      setError(null)

      try {
        const response = await apiClient.get(`/api/experiments/${id}`)

        if (isCancelled) {
          return
        }

        setExperiment(response.data)

        if (!ACTIVE_STATUSES.includes(response.data.status) && intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      } catch (err) {
        console.error(err)

        if (isCancelled) {
          return
        }

        if (err.response?.status === 404) {
          setError('Experiment not found.')
        } else {
          setError('Failed to fetch experiment.')
        }

        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      } finally {
        if (showLoading && !isCancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchExperiment({ showLoading: true })

    intervalRef.current = setInterval(() => {
      fetchExperiment({ showLoading: false })
    }, POLL_INTERVAL_MS)

    return () => {
      isCancelled = true

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
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