import { useEffect, useState } from 'react'
import apiClient from './api/client'
import { ALGORITHM_CONFIGS, getAlgorithmLabel } from './config/algorithms'

function fieldVisible(field, parameters) {
  if (!field.showWhen) {
    return true
  }
  return parameters[field.showWhen.field] === field.showWhen.value
}

function CreateExperiment({ onSuccess }) {
  const [metadata, setMetadata] = useState({
    name: '',
    algorithm: 'QMC_European',
    execution_target: 'local_sync',
    ibm_api_token: '',
  })

  const [parameters, setParameters] = useState({})
  const [meshUploadInfo, setMeshUploadInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  function handleMetadataChange(event) {
    const { name, value } = event.target

    setMetadata((current) => ({
      ...current,
      [name]: value,
      ...(name === 'execution_target' && value !== 'ibm_qpu'
        ? { ibm_api_token: '' }
        : {}),
    }))
  }

  function handleParameterChange(event) {
    setParameters({ ...parameters, [event.target.name]: event.target.value })
  }

  async function handleMeshUpload(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setError(null)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await apiClient.post('/api/meshes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setMeshUploadInfo(response.data)
      setParameters((current) => ({
        ...current,
        mesh_id: response.data.mesh_id,
      }))
    } catch (uploadError) {
      console.error(uploadError)
      setError('Failed to upload CGNS mesh.')
    }
  }

  useEffect(() => {
    const config = ALGORITHM_CONFIGS[metadata.algorithm]

    if (config) {
      const initialParams = {}

      config.fields.forEach((field) => {
        if (field.default !== undefined) {
          initialParams[field.name] = field.default
        }
      })

      setParameters(initialParams)
      setMeshUploadInfo(null)
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
        if (!fieldVisible(field, parameters)) {
          return
        }

        let value = parameters[field.name]

        if ((value === '' || value === undefined || value === null) && field.default !== undefined) {
          value = field.default
        }

        if (field.type === 'file') {
          return
        }

        if (value === '' || value === undefined || value === null) {
          return
        }

        if (field.dataType === 'float') {
          const parsed = parseFloat(value)
          if (!Number.isNaN(parsed)) {
            parsedParameters[field.name] = parsed
          }
        } else if (field.dataType === 'int') {
          const parsed = parseInt(value, 10)
          if (!Number.isNaN(parsed)) {
            parsedParameters[field.name] = parsed
          }
        } else {
          parsedParameters[field.name] = value
        }
      })

      if (parsedParameters.mesh_source === 'upload') {
        if (!parameters.mesh_id) {
          setError('Upload a CGNS mesh before running.')
          setIsLoading(false)
          return
        }
        parsedParameters.mesh_id = parameters.mesh_id
      }

      parsedParameters.execution_target = metadata.execution_target

      if (metadata.execution_target === 'ibm_qpu') {
        parsedParameters.ibm_api_token = metadata.ibm_api_token
      }

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

  const activeConfig = ALGORITHM_CONFIGS[metadata.algorithm]

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
            placeholder="e.g. Lid Cavity HHL Run 1"
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
                {getAlgorithmLabel(algorithm)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Execution Target</label>
          <select
            name="execution_target"
            value={metadata.execution_target}
            onChange={handleMetadataChange}
            className="rounded border px-3 py-2"
          >
            <option value="local_sync">Local Synchronous Simulator</option>
            <option value="background_worker">Background Worker Simulator</option>
            <option value="ibm_qpu">IBM Physical QPU</option>
          </select>
        </div>

        {metadata.execution_target === 'ibm_qpu' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="ibm-api-token">
              IBM Quantum API Token
            </label>
            <input
              id="ibm-api-token"
              type="password"
              name="ibm_api_token"
              value={metadata.ibm_api_token}
              onChange={handleMetadataChange}
              placeholder="Paste your IBM Quantum API token"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              className="rounded border px-3 py-2"
            />
          </div>
        )}

        {activeConfig?.fields
          .filter((field) => fieldVisible(field, parameters))
          .map((field) => (
            <div key={field.name} className="flex flex-col gap-1">
              <label className="text-sm font-medium">{field.label}</label>

              {field.type === 'select' || field.type === 'preset_select' ? (
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
              ) : field.type === 'file' ? (
                <input
                  type="file"
                  name={field.name}
                  accept={field.accept}
                  onChange={handleMeshUpload}
                  className="rounded border px-3 py-2"
                />
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

              {field.helperText && (
                <p className="text-xs text-slate-500">{field.helperText}</p>
              )}

              {field.name === 'mesh_preset' && (
                <p className="text-xs text-amber-700">
                  Estimated DOFs: ~12 (2×2 cavity). Runs with system size &gt; 24 queue to Celery.
                </p>
              )}

              {field.type === 'file' && meshUploadInfo && (
                <p className="text-xs text-green-700">
                  Uploaded mesh {meshUploadInfo.mesh_id.slice(0, 8)}… ·{' '}
                  {meshUploadInfo.cell_count} cells · {meshUploadInfo.system_size_n} DOFs
                </p>
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
