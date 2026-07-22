import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import apiClient from '../api/client'
import ExperimentDetail from '../ExperimentDetail'

const POLL_INTERVAL_MS = 3000
const ACTIVE_STATUSES = ['queued', 'running']
const TERMINAL_STATUSES = ['completed', 'failed']

function normalizeProgressLog(progressLog) {
  return Array.isArray(progressLog) ? progressLog : []
}

function buildEventKey(event) {
  return [
    event?.event_type ?? '',
    event?.status ?? '',
    event?.timestamp ?? '',
    JSON.stringify(event?.data ?? {}),
  ].join('|')
}

function mergeProgressLogs(baseLog, extraLog) {
  const merged = []
  const seen = new Set()

  for (const event of [...normalizeProgressLog(baseLog), ...normalizeProgressLog(extraLog)]) {
    const key = buildEventKey(event)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    merged.push(event)
  }

  return merged
}

function getExperimentWebSocketUrl(experimentId) {
  const apiBaseUrl = apiClient.defaults.baseURL

  if (apiBaseUrl) {
    try {
      const parsed = new URL(apiBaseUrl)
      const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${parsed.host}/ws/experiments/${experimentId}`
    } catch (error) {
      console.error('Invalid API baseURL, falling back to window location.', error)
    }
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/experiments/${experimentId}`
}

function ExperimentDetailPage() {
  const { id } = useParams()

  const [experiment, setExperiment] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false)

  const intervalRef = useRef(null)
  const websocketRef = useRef(null)

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

        setExperiment((current) => {
          if (!current) {
            return response.data
          }

          return {
            ...response.data,
            progress_log: mergeProgressLogs(response.data.progress_log, current.progress_log),
          }
        })

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

    if (!isWebSocketConnected) {
      intervalRef.current = setInterval(() => {
        fetchExperiment({ showLoading: false })
      }, POLL_INTERVAL_MS)
    }

    return () => {
      isCancelled = true

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      if (websocketRef.current) {
        websocketRef.current.close()
        websocketRef.current = null
      }
    }
  }, [id, isWebSocketConnected])

  useEffect(() => {
    if (!id) {
      return
    }

    const wsUrl = getExperimentWebSocketUrl(id)
    const socket = new WebSocket(wsUrl)
    websocketRef.current = socket

    socket.onopen = () => {
      setIsWebSocketConnected(true)
    }

    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data)

        setExperiment((current) => {
          if (!current) {
            return current
          }

          const nextStatus = event.status ?? current.status

          return {
            ...current,
            status: nextStatus,
            progress_log: mergeProgressLogs(current.progress_log, [event]),
          }
        })

        if (TERMINAL_STATUSES.includes(event.status)) {
          socket.close()
        }
      } catch (error) {
        console.error('Failed to parse websocket event payload.', error)
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error for experiment stream:', error)
      setIsWebSocketConnected(false)
    }

    socket.onclose = () => {
      setIsWebSocketConnected(false)
    }

    return () => {
      socket.close()
      if (websocketRef.current === socket) {
        websocketRef.current = null
      }
      setIsWebSocketConnected(false)
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