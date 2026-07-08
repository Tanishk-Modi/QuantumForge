import { useState, useEffect } from "react"
import apiClient from "./api/client"
import { ALGORITHM_CONFIGS } from "./config/algorithms"

function CreateExperiment({ onSuccess }) {

    // fixed parameters
    const [metadata, setMetadata] = useState({
        name: "",
        algorithm: "QMC_European"
    })
    const [parameters, setParameters] = useState({})

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    // change handlers for fixed metadata and dynamic parameters
    const handleMetadataChange = (e) => {
        setMetadata({ ...metadata, [e.target.name]: e.target.value })
    }

    const handleParameterChange = (e) => {
        setParameters({ ...parameters, [e.target.name]: e.target.value })
    }

    // initialize parameters when the algorithm changes
    useEffect(() => {
        const config = ALGORITHM_CONFIGS[metadata.algorithm]
        if (config) {
            const initialParams = {}
            config.fields.forEach(field => {
                initialParams[field.name] = field.default
            })
            setParameters(initialParams)
        }
    }, [metadata.algorithm])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setSuccess(false)

        try {
            // dynamically parse types based on the config
            const activeFields = ALGORITHM_CONFIGS[metadata.algorithm].fields
            const parsedParameters = {}

            activeFields.forEach(field => {
                const val = parameters[field.name]
                if (field.dataType === "float") parsedParameters[field.name] = parseFloat(val)
                else if (field.dataType === "int") parsedParameters[field.name] = parseInt(val)
                else parsedParameters[field.name] = val
            })

            const payload = {
                name: metadata.name,
                algorithm: metadata.algorithm,
                parameters: parsedParameters
            }

            const response = await apiClient.post("/api/experiments", payload)
            setSuccess(true)
            onSuccess()

        } catch (err) {
            setError("Failed to create experiment.")
        } finally {
            setIsLoading(false)
        }
    }


    return (
        <div className="border rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">New Experiment</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="off">
                
                {/* Fixed Metadata Inputs */}
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Experiment Name</label>
                    <input type="text" name="name" value={metadata.name} onChange={handleMetadataChange} placeholder="e.g. High Vol Run 1" className="border rounded px-3 py-2" />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Algorithm</label>
                    <select name="algorithm" value={metadata.algorithm} onChange={handleMetadataChange} className="border rounded px-3 py-2">
                        {Object.keys(ALGORITHM_CONFIGS).map(algo => (
                            <option key={algo} value={algo}>{algo}</option>
                        ))}
                    </select>
                </div>

                {/* Dynamic Parameter Inputs mapped from schema */}
                {ALGORITHM_CONFIGS[metadata.algorithm]?.fields.map(field => (
                    <div key={field.name} className="flex flex-col gap-1">
                        <label className="text-sm font-medium">{field.label}</label>
                        
                        {field.type === "select" ? (
                            <select
                                name={field.name}
                                value={parameters[field.name] ?? ""}
                                onChange={handleParameterChange}
                                className="border rounded px-3 py-2"
                            >
                                {field.options.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type={field.type}
                                name={field.name}
                                value={parameters[field.name] ?? ""}
                                onChange={handleParameterChange}
                                placeholder={field.placeholder}
                                step={field.step}
                                min={field.min}
                                max={field.max}
                                className="border rounded px-3 py-2"
                            />
                        )}
                    </div>
                ))}

                {error && <p className="text-sm text-red-500">{error}</p>}
                {success && <p className="text-sm text-green-600">Experiment created successfully.</p>}

                <button type="submit" disabled={isLoading} className="mt-2 self-start px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                    {isLoading ? "Running..." : "Run Experiment"}
                </button>
            </form>
        </div>
    )
        
}

export default CreateExperiment