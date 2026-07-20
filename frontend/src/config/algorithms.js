// frontend schema registry

export const ALGORITHM_CONFIGS = {
  QMC_European: {
    label: "European Option (QMC)",
    hasAnalyticalBaseline: true,
    resultLabels: {
      analytical: "Black-Scholes",
      classical: "Classical MC",
      quantum: "Quantum MC",
    },
    summaryFields: ["stock_price", "volatility", "strike_price", "n_shots", "simulator"],
    fields: [
      {
        name: "stock_price",
        label: "Stock Price ($)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 100",
        default: "",
      },
      {
        name: "volatility",
        label: "Volatility (0 – 1)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 0.3",
        step: "0.01",
        min: "0",
        max: "1",
        default: "",
      },
      {
        name: "strike_price",
        label: "Strike Price ($)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 105",
        default: "",
      },
      {
        name: "risk_free_rate",
        label: "Risk-Free Rate (annual)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 0.05",
        step: "0.01",
        min: "0",
        default: "0.05",
      },
      {
        name: "time_to_expiry",
        label: "Time to Expiry (years)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 1.0",
        step: "0.25",
        min: "0",
        default: "1.0",
      },
      {
        name: "num_uncertainty_qubits",
        label: "Uncertainty Qubits",
        type: "select",
        dataType: "int",
        default: "3",
        helperText: "Higher qubit counts increase fidelity, but values above 5 should run asynchronously.",
        options: [
          { value: "3", label: "3 — fast, lower precision" },
          { value: "4", label: "4" },
          { value: "5", label: "5" },
          { value: "6", label: "6 — async recommended" },
          { value: "7", label: "7 — async recommended" },
          { value: "8", label: "8 — async recommended" },
          { value: "9", label: "9 — async recommended" },
          { value: "10", label: "10 — async required" },
        ],
      },
      {
        name: "n_shots",
        label: "Number of Shots",
        type: "select",
        dataType: "int",
        default: "",
        options: [
          { value: "", label: "Select shots" },
          { value: "512", label: "512" },
          { value: "1024", label: "1024" },
          { value: "2048", label: "2048" },
          { value: "4096", label: "4096" },
        ],
      },
      {
        name: "simulator",
        label: "Simulator",
        type: "select",
        dataType: "string",
        default: "aer_simulator",
        options: [
          { value: "aer_simulator", label: "Aer Simulator" },
          { value: "statevector_simulator", label: "Statevector Simulator" },
        ],
      },
    ],
  },

  QMC_Basket: {
    label: "Basket Option (QMC)",
    hasAnalyticalBaseline: false,
    resultLabels: {
      classical: "Classical MC",
      quantum: "Quantum MC",
    },
    summaryFields: [
      "spot_price_1",
      "spot_price_2",
      "volatility_1",
      "volatility_2",
      "strike_price",
      "n_shots",
      "simulator",
    ],
    fields: [
      {
        name: "spot_price_1",
        label: "Asset 1 Spot Price ($)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 100",
        default: "",
      },
      {
        name: "spot_price_2",
        label: "Asset 2 Spot Price ($)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 95",
        default: "",
      },
      {
        name: "volatility_1",
        label: "Asset 1 Volatility (0 – 1)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 0.25",
        step: "0.01",
        min: "0",
        max: "1",
        default: "",
      },
      {
        name: "volatility_2",
        label: "Asset 2 Volatility (0 – 1)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 0.30",
        step: "0.01",
        min: "0",
        max: "1",
        default: "",
      },
      {
        name: "asset_weight_1",
        label: "Asset 1 Weight",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 0.5",
        step: "0.01",
        min: "0",
        max: "1",
        default: "0.5",
      },
      {
        name: "asset_weight_2",
        label: "Asset 2 Weight",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 0.5",
        step: "0.01",
        min: "0",
        max: "1",
        default: "0.5",
      },
      {
        name: "strike_price",
        label: "Strike Price ($)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 105",
        default: "",
      },
      {
        name: "risk_free_rate",
        label: "Risk-Free Rate (annual)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 0.05",
        step: "0.01",
        min: "0",
        default: "0.05",
      },
      {
        name: "time_to_expiry",
        label: "Time to Expiry (years)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 1.0",
        step: "0.25",
        min: "0",
        default: "1.0",
      },
      {
        name: "num_uncertainty_qubits",
        label: "Uncertainty Qubits",
        type: "select",
        dataType: "int",
        default: "3",
        helperText: "Higher qubit counts increase fidelity, but values above 5 should run asynchronously.",
        options: [
          { value: "3", label: "3 — fast, lower precision" },
          { value: "4", label: "4" },
          { value: "5", label: "5" },
          { value: "6", label: "6 — async recommended" },
          { value: "7", label: "7 — async recommended" },
          { value: "8", label: "8 — async recommended" },
          { value: "9", label: "9 — async recommended" },
          { value: "10", label: "10 — async required" },
        ],
      },
      {
        name: "n_shots",
        label: "Number of Shots",
        type: "select",
        dataType: "int",
        default: "",
        options: [
          { value: "", label: "Select shots" },
          { value: "512", label: "512" },
          { value: "1024", label: "1024" },
          { value: "2048", label: "2048" },
          { value: "4096", label: "4096" },
        ],
      },
      {
        name: "simulator",
        label: "Simulator",
        type: "select",
        dataType: "string",
        default: "aer_simulator",
        options: [
          { value: "aer_simulator", label: "Aer Simulator" },
          { value: "statevector_simulator", label: "Statevector Simulator" },
        ],
      },
    ],
  },

  QMC_Asian: {
    label: "Asian Option (QMC)",
    hasAnalyticalBaseline: false,
    resultLabels: {
      classical: "Classical MC",
      quantum: "Quantum MC",
    },
    summaryFields: [
      "spot_price",
      "volatility",
      "monitoring_dates",
      "strike_price",
      "n_shots",
      "simulator",
    ],
    fields: [
      {
        name: "spot_price",
        label: "Spot Price ($)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 100",
        default: "",
      },
      {
        name: "strike_price",
        label: "Strike Price ($)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 105",
        default: "",
      },
      {
        name: "volatility",
        label: "Volatility (0 – 1)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 0.3",
        step: "0.01",
        min: "0",
        max: "1",
        default: "",
      },
      {
        name: "risk_free_rate",
        label: "Risk-Free Rate (annual)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 0.05",
        step: "0.01",
        min: "0",
        default: "0.05",
      },
      {
        name: "time_to_expiry",
        label: "Time to Expiry (years)",
        type: "number",
        dataType: "float",
        placeholder: "e.g. 1.0",
        step: "0.25",
        min: "0",
        default: "1.0",
      },
      {
        name: "monitoring_dates",
        label: "Monitoring Dates",
        type: "number",
        dataType: "int",
        placeholder: "e.g. 12",
        step: "1",
        min: "2",
        max: "20",
        default: "12",
      },
      {
        name: "num_uncertainty_qubits",
        label: "Uncertainty Qubits",
        type: "select",
        dataType: "int",
        default: "3",
        helperText: "Higher qubit counts increase fidelity, but values above 5 should run asynchronously.",
        options: [
          { value: "3", label: "3 — fast, lower precision" },
          { value: "4", label: "4" },
          { value: "5", label: "5" },
          { value: "6", label: "6 — async recommended" },
          { value: "7", label: "7 — async recommended" },
          { value: "8", label: "8 — async recommended" },
          { value: "9", label: "9 — async recommended" },
          { value: "10", label: "10 — async required" },
        ],
      },
      {
        name: "n_shots",
        label: "Number of Shots",
        type: "select",
        dataType: "int",
        default: "",
        options: [
          { value: "", label: "Select shots" },
          { value: "512", label: "512" },
          { value: "1024", label: "1024" },
          { value: "2048", label: "2048" },
          { value: "4096", label: "4096" },
        ],
      },
      {
        name: "simulator",
        label: "Simulator",
        type: "select",
        dataType: "string",
        default: "aer_simulator",
        options: [
          { value: "aer_simulator", label: "Aer Simulator" },
          { value: "statevector_simulator", label: "Statevector Simulator" },
        ],
      },
    ],
  },
};

// -- Shared helpers so components never hardcode field names or labels -- //

export function getFieldConfig(algorithm, fieldName) {
  const config = ALGORITHM_CONFIGS[algorithm];
  if (!config) return null;
  return config.fields.find((field) => field.name === fieldName) ?? null;
}

// Returns [{ name, label }] for the fields an algorithm wants shown in
// summary/comparison views (selection previews, compare table columns, etc).
export function getSummaryFields(algorithm) {
  const config = ALGORITHM_CONFIGS[algorithm];
  if (!config) return [];

  return config.summaryFields.map((fieldName) => {
    const field = getFieldConfig(algorithm, fieldName);
    return { name: fieldName, label: field?.label ?? fieldName };
  });
}

export function getResultLabels(algorithm) {
  return (
    ALGORITHM_CONFIGS[algorithm]?.resultLabels ?? {
      classical: "Classical MC",
      quantum: "Quantum MC",
    }
  );
}

export function hasAnalyticalBaseline(algorithm) {
  return Boolean(ALGORITHM_CONFIGS[algorithm]?.hasAnalyticalBaseline);
}

export function getAlgorithmLabel(algorithm) {
  return ALGORITHM_CONFIGS[algorithm]?.label ?? algorithm;
}