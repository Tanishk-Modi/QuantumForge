import { useState } from "react"
import apiClient from "./api/client"

function CreateExperiment() {

    const [formData, setFormData] = useState({
        name: "",
        algorithm: "QMC",
        stock_price: "",
        volatility: "",
        strike_price: "",
        n_shots: "",
        simulator: "aer_simulator"
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
                    stock_price: parseFloat(formData.stock_price),
                    volatility: parseFloat(formData.volatility),
                    strike_price: parseFloat(formData.strike_price),
                    n_shots: parseInt(formData.n_shots),
                    simulator: formData.simulator
                }
            }

            const response = await apiClient.post("/api/experiments", payload)
            console.log(response.data)
            setSuccess(true)

        } catch (err) {
            console.error(err)
            setError("Failed to create experiment.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div>
            <h2>New Experiment</h2>

            <form onSubmit={handleSubmit}>

                <div>
                    <label>Experiment Name</label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g. High Vol Run 1"
                    />
                </div>

                <div>
                    <label>Algorithm</label>
                    <input
                        type="text"
                        name="algorithm"
                        value={formData.algorithm}
                        readOnly
                    />
                </div>

                <div>
                    <label>Stock Price ($)</label>
                    <input
                        type="number"
                        name="stock_price"
                        value={formData.stock_price}
                        onChange={handleChange}
                        placeholder="e.g. 100"
                    />
                </div>

                <div>
                    <label>Volatility (0 - 1)</label>
                    <input
                        type="number"
                        name="volatility"
                        value={formData.volatility}
                        onChange={handleChange}
                        placeholder="e.g. 0.3"
                        step="0.01"
                        min="0"
                        max="1"
                    />
                </div>

                <div>
                    <label>Strike Price ($)</label>
                    <input
                        type="number"
                        name="strike_price"
                        value={formData.strike_price}
                        onChange={handleChange}
                        placeholder="e.g. 105"
                    />
                </div>

                <div>
                    <label>Number of Shots</label>
                    <select
                        name="n_shots"
                        value={formData.n_shots}
                        onChange={handleChange}
                    >
                        <option value="">Select shots</option>
                        <option value="512">512</option>
                        <option value="1024">1024</option>
                        <option value="2048">2048</option>
                        <option value="4096">4096</option>
                    </select>
                </div>

                <div>
                    <label>Simulator</label>
                    <select
                        name="simulator"
                        value={formData.simulator}
                        onChange={handleChange}
                    >
                        <option value="aer_simulator">Aer Simulator</option>
                        <option value="statevector_simulator">Statevector Simulator</option>
                    </select>
                </div>

                {error && <p>{error}</p>}
                {success && <p>Experiment created successfully.</p>}

                <button type="submit" disabled={isLoading}>
                    {isLoading ? "Running..." : "Run Experiment"}
                </button>

            </form>
        </div>
    )
}

export default CreateExperiment