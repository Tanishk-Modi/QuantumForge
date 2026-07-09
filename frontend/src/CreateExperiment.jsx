import { useEffect, useState } from 'react'
import apiClient from './api/client'
import { ALGORITHM_CONFIGS } from './config/algorithms'

function CreateExperiment({ onSuccess }) {
  const [metadata, setMetadata] = useState({
    name: '',
    algorithm: 'QMC_European',
  })

  const [parameters, setParameters] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  function handleMetadataChange(event) {
    setMetadata({ ...metadata, [event.target.name]: event.target.value })
  }

  function handleParameterChange(event) {
    setParameters({ ...parameters, [event.target.name]: event.target.value })
  }

  useEffect(() => {
    const config = ALGORITHM_CONFIGS[metadata.algorithm]

    if (config) {
      const initialParams = {}

      config.fields.forEach((field) => {
        initialParams[field.name] = field.default
      })

      setParameters(initialParams)
    }
  }, [metadata.algorithm])

  async function handleSubmit(event) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const activeFields = ALGORITHM_CONFIGS[metadata.algorithm].fields
      const parsedParameters = {}

      activeFields.forEach((field) => {
        const value = parameters[field.name]

        if (field.dataType === 'float') {
          parsedParameters[field.name] = parseFloat(value)
        } else if (field.dataType === 'int') {
          parsedParameters[field.name] = parseInt(value, 10)
        } else {
          parsedParameters[field.name] = value
        }
      })

      const payload = {
        name: metadata.name,
        algorithm: metadata.algorithm,
        parameters: parsedParameters,
      }

      const response = await apiClient.post('/api/experiments', payload)

      setSuccess(true)

      if (onSuccess) {
        onSuccess(response.data)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to create experiment.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">New Experiment</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="off">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Experiment Name</label>
          <input
            type="text"
            name="name"
            value={metadata.name}
            onChange={handleMetadataChange}
            placeholder="e.g. High Vol Run 1"
            className="rounded border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Algorithm</label>
          <select
            name="algorithm"
            value={metadata.algorithm}
            onChange={handleMetadataChange}
            className="rounded border px-3 py-2"
          >
            {Object.keys(ALGORITHM_CONFIGS).map((algorithm) => (
              <option key={algorithm} value={algorithm}>
                {algorithm}
              </option>
            ))}
          </select>
        </div>

        {ALGORITHM_CONFIGS[metadata.algorithm]?.fields.map((field) => (
          <div key={field.name} className="flex flex-col gap-1">
            <label className="text-sm font-medium">{field.label}</label>

            {field.type === 'select' ? (
              <select
                name={field.name}
                value={parameters[field.name] ?? ''}
                onChange={handleParameterChange}
                className="rounded border px-3 py-2"
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                name={field.name}
                value={parameters[field.name] ?? ''}
                onChange={handleParameterChange}
                placeholder={field.placeholder}
                step={field.step}
                min={field.min}
                max={field.max}
                className="rounded border px-3 py-2"
              />
            )}
          </div>
        ))}

        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && (
          <p className="text-sm text-green-600">
            Experiment created successfully.
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 self-start rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Running...' : 'Run Experiment'}
        </button>
      </form>
    </div>
  )
}

export default CreateExperiment