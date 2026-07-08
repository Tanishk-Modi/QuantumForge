import apiClient from "./api/client"

// destructuring the props
function ExperimentList({ experiments, selectedExperiment, isLoading, error, onDelete, onSelect }) {

    async function handleDelete(id) {
        try {
            await apiClient.delete(`/api/experiments/${id}`)
            onDelete()
        } catch (error) {
            console.error(error)
        }
    }

    // edge cases
    if (isLoading) return <p className="text-gray-500 mt-4">Loading experiments...</p>
    if (error) return <p className="text-red-500 mt-4">{error}</p>
    if (experiments.length === 0) return <p className="text-gray-400 mt-4">No experiments yet.</p>

    return (
        <div>
            <h2 className="text-xl font-semibold mb-3">Experiments</h2>
            <div className="flex flex-col gap-2">
                {experiments.map((exp) => (
                    <div
                        key={exp.id}
                        onClick={() => onSelect(exp)}
                        className={`flex justify-between items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedExperiment?.id === exp.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'hover:bg-gray-50'
                        }`}
                    >
                        <div>
                            <p className="font-medium">{exp.name}</p>
                            <p className="text-sm text-gray-500">
                                {exp.algorithm} · {exp.status} · {new Date(exp.created_at).toLocaleString()}
                            </p>
                        </div>
                        <button
                            onClick={() => handleDelete(exp.id)}
                            className="text-sm text-red-500 hover:text-red-700"
                        >
                            Delete
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default ExperimentList