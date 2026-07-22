import { useNavigate } from 'react-router-dom'
import apiClient from './api/client'

const STATUS_BADGE_STYLES = {
  queued: 'bg-gray-100 text-gray-700',
  running: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

function formatBackendDateTime(value) {
  if (!value) {
    return 'Unknown time'
  }

  const normalized =
    typeof value === 'string' && !/(Z|[+-]\d{2}:\d{2})$/.test(value)
      ? `${value}Z`
      : value

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? 'Unknown time' : parsed.toLocaleString()
}

function StatusBadge({ status }) {
  const style = STATUS_BADGE_STYLES[status] ?? 'bg-gray-100 text-gray-700'

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  )
}

function ExperimentList({ experiments, isLoading, error, onDelete }) {
  const navigate = useNavigate()

  async function handleDelete(event, id) {
    event.stopPropagation()

    try {
      await apiClient.delete(`/api/experiments/${id}`)
      onDelete()
    } catch (deleteError) {
      console.error(deleteError)
    }
  }

  if (isLoading) {
    return <p className="mt-4 text-gray-500">Loading experiments...</p>
  }

  if (error) {
    return <p className="mt-4 text-red-500">{error}</p>
  }

  if (experiments.length === 0) {
    return <p className="mt-4 text-gray-400">No experiments yet.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {experiments.map((experiment) => (
        <button
          key={experiment.id}
          type="button"
          onClick={() => navigate(`/experiments/${experiment.id}`)}
          className="flex items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-gray-50"
        >
          <div>
            <p className="font-medium">{experiment.name}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <span>{experiment.algorithm}</span>
              <span>·</span>
              <StatusBadge status={experiment.status} />
              <span>·</span>
              <span>{formatBackendDateTime(experiment.created_at)}</span>
            </p>
          </div>

          <span
            onClick={(event) => handleDelete(event, experiment.id)}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Delete
          </span>
        </button>
      ))}
    </div>
  )
}

export default ExperimentList