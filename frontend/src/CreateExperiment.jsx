import { useState } from "react"
import apiClient from "./api/client"

function CreateExperiment({ onSuccess }) {

    const [formData, setFormData] = useState({
        name: "",
        algorithm: "QMC_European",
        stock_price: "",
        volatility: "",
        strike_price: "",
        n_shots: "",
        simulator: "aer_simulator",
        risk_free_rate: "0.05",
        time_to_expiry: "1.0",
        num_uncertainty_qubits: "3"
    })

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setSuccess(false)

        try {
            // restructure form data into proper shape for backend
            const payload = {
                name: formData.name,
                algorithm: formData.algorithm,
                parameters: {
                    stock_price:             parseFloat(formData.stock_price),
                    volatility:              parseFloat(formData.volatility),
                    strike_price:            parseFloat(formData.strike_price),
                    n_shots:                 parseInt(formData.n_shots),
                    simulator:               formData.simulator,
                    risk_free_rate:          parseFloat(formData.risk_free_rate),
                    time_to_expiry:          parseFloat(formData.time_to_expiry),
                    num_uncertainty_qubits:  parseInt(formData.num_uncertainty_qubits)
                }
            }

            const response = await apiClient.post("/api/experiments", payload)
            console.log(response.data)
            setSuccess(true)
            onSuccess()

        } catch (err) {
            console.error(err)
            setError("Failed to create experiment.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="border rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">New Experiment</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="off">

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Experiment Name</label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g. High Vol Run 1"
                        className="border rounded px-3 py-2"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Algorithm</label>
                    <input
                        type="text"
                        name="algorithm"
                        value={formData.algorithm}
                        readOnly
                        className="border rounded px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Stock Price ($)</label>
                    <input
                        type="number"
                        name="stock_price"
                        value={formData.stock_price}
                        onChange={handleChange}
                        placeholder="e.g. 100"
                        className="border rounded px-3 py-2"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Volatility (0 – 1)</label>
                    <input
                        type="number"
                        name="volatility"
                        value={formData.volatility}
                        onChange={handleChange}
                        placeholder="e.g. 0.3"
                        step="0.01"
                        min="0"
                        max="1"
                        className="border rounded px-3 py-2"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Strike Price ($)</label>
                    <input
                        type="number"
                        name="strike_price"
                        value={formData.strike_price}
                        onChange={handleChange}
                        placeholder="e.g. 105"
                        className="border rounded px-3 py-2"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Risk-Free Rate (annual)</label>
                    <input
                        type="number"
                        name="risk_free_rate"
                        value={formData.risk_free_rate}
                        onChange={handleChange}
                        placeholder="e.g. 0.05"
                        step="0.01"
                        min="0"
                        className="border rounded px-3 py-2"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Time to Expiry (years)</label>
                    <input
                        type="number"
                        name="time_to_expiry"
                        value={formData.time_to_expiry}
                        onChange={handleChange}
                        placeholder="e.g. 1.0"
                        step="0.25"
                        min="0"
                        className="border rounded px-3 py-2"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Uncertainty Qubits</label>
                    <select
                        name="num_uncertainty_qubits"
                        value={formData.num_uncertainty_qubits}
                        onChange={handleChange}
                        className="border rounded px-3 py-2"
                    >
                        <option value="3">3 — fast, lower precision</option>
                        <option value="4">4</option>
                        <option value="5">5 — slower, higher precision</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Number of Shots</label>
                    <select
                        name="n_shots"
                        value={formData.n_shots}
                        onChange={handleChange}
                        className="border rounded px-3 py-2"
                    >
                        <option value="">Select shots</option>
                        <option value="512">512</option>
                        <option value="1024">1024</option>
                        <option value="2048">2048</option>
                        <option value="4096">4096</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Simulator</label>
                    <select
                        name="simulator"
                        value={formData.simulator}
                        onChange={handleChange}
                        className="border rounded px-3 py-2"
                    >
                        <option value="aer_simulator">Aer Simulator</option>
                        <option value="statevector_simulator">Statevector Simulator</option>
                    </select>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}
                {success && <p className="text-sm text-green-600">Experiment created successfully.</p>}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-2 self-start px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {isLoading ? "Running..." : "Run Experiment"}
                </button>

            </form>
        </div>
    )
}

export default CreateExperiment