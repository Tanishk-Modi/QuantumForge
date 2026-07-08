export const ALGORITHM_CONFIGS = {
    QMC_European: {
        fields: [
            { name: "stock_price", label: "Stock Price ($)", type: "number", dataType: "float", placeholder: "e.g. 100", default: "" },
            { name: "volatility", label: "Volatility (0 – 1)", type: "number", dataType: "float", placeholder: "e.g. 0.3", step: "0.01", min: "0", max: "1", default: "" },
            { name: "strike_price", label: "Strike Price ($)", type: "number", dataType: "float", placeholder: "e.g. 105", default: "" },
            { name: "risk_free_rate", label: "Risk-Free Rate (annual)", type: "number", dataType: "float", placeholder: "e.g. 0.05", step: "0.01", min: "0", default: "0.05" },
            { name: "time_to_expiry", label: "Time to Expiry (years)", type: "number", dataType: "float", placeholder: "e.g. 1.0", step: "0.25", min: "0", default: "1.0" },
            { name: "num_uncertainty_qubits", label: "Uncertainty Qubits", type: "select", dataType: "int", default: "3", 
              options: [{ value: "3", label: "3 — fast, lower precision" }, { value: "4", label: "4" }, { value: "5", label: "5 — slower, higher precision" }] },
            { name: "n_shots", label: "Number of Shots", type: "select", dataType: "int", default: "", 
              options: [{ value: "", label: "Select shots" }, { value: "512", label: "512" }, { value: "1024", label: "1024" }, { value: "2048", label: "2048" }, { value: "4096", label: "4096" }] },
            { name: "simulator", label: "Simulator", type: "select", dataType: "string", default: "aer_simulator", 
              options: [{ value: "aer_simulator", label: "Aer Simulator" }, { value: "statevector_simulator", label: "Statevector Simulator" }] }
        ]
    },

    // New algorithms get appended here

    QMC_Asian: {
        fields: [
            { name: "stock_price", label: "Stock Price ($)", type: "number", dataType: "float", placeholder: "e.g. 100", default: "" },
            { name: "volatility", label: "Volatility (0 – 1)", type: "number", dataType: "float", placeholder: "e.g. 0.3", step: "0.01", min: "0", max: "1", default: "" },
        ]
    }

}