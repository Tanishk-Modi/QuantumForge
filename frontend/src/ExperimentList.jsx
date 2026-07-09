import { useNavigate } from 'react-router-dom'
import apiClient from './api/client'

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
            <p className="text-sm text-gray-500">
              {experiment.algorithm} · {experiment.status} ·{' '}
              {new Date(experiment.created_at).toLocaleString()}
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