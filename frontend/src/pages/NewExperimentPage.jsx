import { useNavigate } from 'react-router-dom'
import CreateExperiment from '../CreateExperiment'

function NewExperimentPage() {
  const navigate = useNavigate()

  function handleSuccess(createdExperiment) {
    navigate(`/experiments/${createdExperiment.id}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Create New Experiment</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure parameters and launch a quantum pricing run.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <CreateExperiment onSuccess={handleSuccess} />
      </div>
    </div>
  )
}

export default NewExperimentPage