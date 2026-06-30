import { useState, useEffect } from 'react'
import apiClient from './api/client'
import CreateExperiment from './CreateExperiment'
import ExperimentList from './ExperimentList'

function App() {

  const [experiments, setExperiments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  async function fetchExperiments() {
    setIsLoading(true)
    try {
      const response = await apiClient.get("/api/experiments")
      setExperiments(response.data)
    } catch (err) {
      console.error(err)
      setError("Failed to fetch experiments.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchExperiments()
  }, [])

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">QForge</h1>
      <CreateExperiment onSuccess={fetchExperiments} />
      <ExperimentList
        experiments={experiments}
        isLoading={isLoading}
        error={error}
        onDelete={fetchExperiments}
      />
    </div>
  )
}

export default App