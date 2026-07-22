function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function formatFixed(value, decimals = 4) {
  return isFiniteNumber(value) ? value.toFixed(decimals) : 'N/A'
}

function formatInteger(value) {
  return Number.isInteger(value) ? value.toLocaleString() : 'N/A'
}

function createQuantumMonteCarloDisplay({ hasAnalyticalBaseline }) {
  return {
    comparisonTitle: 'Price Comparison',
    comparisonValueLabel: 'Price',
    valueKey: 'price',
    unitPrefix: '$',
    unitSuffix: '',
    valueDecimals: 4,
    axisDecimals: 2,

    getAnalyticalValue(experiment) {
      return experiment.black_scholes_price ?? null
    },

    getClassicalValue(experiment) {
      return experiment.classical_mc_result?.price ?? null
    },

    getQuantumValue(experiment) {
      return experiment.quantum_mc_result?.price ?? null
    },

    formatValue(value, decimals = 4) {
      if (!isFiniteNumber(value)) {
        return 'N/A'
      }

      return `$${value.toFixed(decimals)}`
    },

    getClassicalErrorText(experiment) {
      if (!isFiniteNumber(experiment.error_classical)) {
        return null
      }

      return `Error: ${(experiment.error_classical * 100).toFixed(2)}%`
    },

    getQuantumErrorText(experiment) {
      if (!isFiniteNumber(experiment.error_quantum)) {
        return null
      }

      return `Error: ${(experiment.error_quantum * 100).toFixed(2)}%`
    },

    getClassicalDetailLines({ classicalResult }) {
      const lines = []

      if (isFiniteNumber(classicalResult?.std_dev) && Number.isInteger(classicalResult?.n_samples)) {
        lines.push(
          `σ = ${classicalResult.std_dev.toFixed(4)} · n = ${classicalResult.n_samples.toLocaleString()}`
        )
      }

      if (isFiniteNumber(classicalResult?.runtime_ms)) {
        lines.push(`Runtime: ${classicalResult.runtime_ms.toFixed(0)}ms`)
      }

      if (!hasAnalyticalBaseline) {
        lines.push('Simulation baseline for path-dependent / multi-asset pricing')
      }

      return lines
    },

    getQuantumDetailLines({ quantumResult, resultLabels, showAnalyticalBaseline }) {
      const lines = []

      if (
        isFiniteNumber(quantumResult?.confidence_interval_low) &&
        isFiniteNumber(quantumResult?.confidence_interval_high)
      ) {
        lines.push(
          `CI: [${quantumResult.confidence_interval_low.toFixed(4)}, ${quantumResult.confidence_interval_high.toFixed(4)}]`
        )
      }

      const metricParts = []

      if (Number.isInteger(quantumResult?.qubit_count)) {
        metricParts.push(`${quantumResult.qubit_count}q`)
      }

      if (Number.isInteger(quantumResult?.circuit_depth)) {
        metricParts.push(`depth ${quantumResult.circuit_depth}`)
      }

      if (isFiniteNumber(quantumResult?.runtime_ms)) {
        metricParts.push(`${quantumResult.runtime_ms.toFixed(0)}ms`)
      }

      if (metricParts.length > 0) {
        lines.push(metricParts.join(' · '))
      }

      if (!showAnalyticalBaseline) {
        lines.push(`Error measured against ${resultLabels.classical} baseline`)
      }

      return lines
    },

    confidenceInterval: {
      enabled: true,
      title: 'Quantum Confidence Interval',
      description:
        'The blue band shows the estimated confidence interval, and the dot marks the quantum estimate.',
      estimateKey: 'price',
      lowKey: 'confidence_interval_low',
      highKey: 'confidence_interval_high',
    },

    getComparisonDescription({ showAnalyticalBaseline, resultLabels }) {
      return showAnalyticalBaseline
        ? `Compare the ${resultLabels.analytical} baseline against classical and quantum estimates for each run.`
        : `Compare the ${resultLabels.classical} baseline against the ${resultLabels.quantum} estimate for each run.`
    },

    getErrorComparisonDescription({ showAnalyticalBaseline, resultLabels }) {
      return showAnalyticalBaseline
        ? `Lower percentages mean the estimate stayed closer to the ${resultLabels.analytical} reference.`
        : `Lower percentages mean the estimate stayed closer to the ${resultLabels.classical} baseline.`
    },

    getErrorChartData(experiments) {
      return experiments.map((experiment) => ({
        name: experiment.name,
        classicalError: isFiniteNumber(experiment.error_classical)
          ? experiment.error_classical * 100
          : 0,
        quantumError: isFiniteNumber(experiment.error_quantum)
          ? experiment.error_quantum * 100
          : 0,
      }))
    },

    formatErrorValue(value, decimals = 2) {
      return isFiniteNumber(value) ? `${value.toFixed(decimals)}%` : 'N/A'
    },

    getComparisonHighlight(experiments) {
      const validQuantumErrors = experiments
        .map((experiment) => experiment.error_quantum)
        .filter(isFiniteNumber)

      if (validQuantumErrors.length === 0) {
        return {
          label: 'Best Quantum Error',
          value: 'N/A',
        }
      }

      return {
        label: 'Best Quantum Error',
        value: `${Math.min(...validQuantumErrors.map((value) => value * 100)).toFixed(2)}%`,
      }
    },

    getCompareTableColumns(resultLabels) {
      return [
        {
          label: `${resultLabels.quantum} Price`,
          render: (experiment) => formatFixed(experiment.quantum_mc_result?.price, 4),
        },
        {
          label: 'CI Low',
          render: (experiment) => formatFixed(experiment.quantum_mc_result?.confidence_interval_low, 4),
        },
        {
          label: 'CI High',
          render: (experiment) => formatFixed(experiment.quantum_mc_result?.confidence_interval_high, 4),
        },
        {
          label: 'Qubits',
          render: (experiment) =>
            Number.isInteger(experiment.quantum_mc_result?.qubit_count)
              ? experiment.quantum_mc_result.qubit_count
              : 'N/A',
        },
        {
          label: 'Depth',
          render: (experiment) =>
            Number.isInteger(experiment.quantum_mc_result?.circuit_depth)
              ? experiment.quantum_mc_result.circuit_depth
              : 'N/A',
        },
        {
          label: 'Runtime',
          render: (experiment) =>
            isFiniteNumber(experiment.quantum_mc_result?.runtime_ms)
              ? `${experiment.quantum_mc_result.runtime_ms.toFixed(0)} ms`
              : 'N/A',
        },
      ]
    },
  }
}

function createLinearSolverDisplay() {
  return {
    comparisonTitle: 'Solve Time Comparison',
    comparisonValueLabel: 'Runtime (ms)',
    valueKey: 'runtime_ms',
    unitPrefix: '',
    unitSuffix: 'ms',
    valueDecimals: 2,
    axisDecimals: 0,

    getAnalyticalValue() {
      return null
    },

    getClassicalValue(experiment) {
      return experiment.classical_mc_result?.runtime_ms ?? null
    },

    getQuantumValue(experiment) {
      return experiment.quantum_mc_result?.runtime_ms ?? null
    },

    formatValue(value, decimals = 2) {
      return isFiniteNumber(value) ? `${value.toFixed(decimals)}ms` : 'N/A'
    },

    getClassicalErrorText(experiment) {
      if (!isFiniteNumber(experiment.error_classical)) {
        return null
      }

      return `Residual: ${experiment.error_classical.toExponential(2)}`
    },

    getQuantumErrorText(experiment) {
      if (!isFiniteNumber(experiment.error_quantum)) {
        return null
      }

      return `Solution Error: ${(experiment.error_quantum * 100).toFixed(2)}%`
    },

    getClassicalDetailLines({ classicalResult }) {
      const lines = []

      if (isFiniteNumber(classicalResult?.residual_norm)) {
        lines.push(`Residual norm: ${classicalResult.residual_norm.toExponential(3)}`)
      }

      lines.push('Direct sparse solver baseline (NumPy/SciPy)')

      return lines
    },

    getQuantumDetailLines({ quantumResult }) {
      const lines = []
      const metricParts = []

      if (Number.isInteger(quantumResult?.qubit_count)) {
        metricParts.push(`${quantumResult.qubit_count}q`)
      }

      if (Number.isInteger(quantumResult?.circuit_depth)) {
        metricParts.push(`depth ${quantumResult.circuit_depth}`)
      }

      if (isFiniteNumber(quantumResult?.runtime_ms)) {
        metricParts.push(`${quantumResult.runtime_ms.toFixed(0)}ms`)
      }

      if (metricParts.length > 0) {
        lines.push(metricParts.join(' · '))
      }

      lines.push('Error measured against direct solver solution vector')

      return lines
    },

    confidenceInterval: {
      enabled: false,
    },

    getComparisonDescription() {
      return 'Compare classical direct-solve runtime against quantum HHL runtime for each configuration.'
    },

    getErrorComparisonDescription() {
      return 'Lower percentages/residuals mean the solution stayed closer to the classical solved vector.'
    },

    getErrorChartData(experiments) {
      return experiments.map((experiment) => ({
        name: experiment.name,
        classicalError: isFiniteNumber(experiment.error_classical)
          ? experiment.error_classical * 100
          : 0,
        quantumError: isFiniteNumber(experiment.error_quantum)
          ? experiment.error_quantum * 100
          : 0,
      }))
    },

    formatErrorValue(value, decimals = 2) {
      return isFiniteNumber(value) ? `${value.toFixed(decimals)}%` : 'N/A'
    },

    getComparisonHighlight(experiments) {
      const validRuntimes = experiments
        .map((experiment) => experiment.quantum_mc_result?.runtime_ms)
        .filter(isFiniteNumber)

      if (validRuntimes.length === 0) {
        return {
          label: 'Fastest Quantum Solve',
          value: 'N/A',
        }
      }

      return {
        label: 'Fastest Quantum Solve',
        value: `${Math.min(...validRuntimes).toFixed(0)}ms`,
      }
    },

    getCompareTableColumns(resultLabels) {
      return [
        {
          label: `${resultLabels.quantum} Runtime`,
          render: (experiment) => formatFixed(experiment.quantum_mc_result?.runtime_ms, 2),
        },
        {
          label: 'Qubits',
          render: (experiment) =>
            Number.isInteger(experiment.quantum_mc_result?.qubit_count)
              ? experiment.quantum_mc_result.qubit_count
              : 'N/A',
        },
        {
          label: 'Depth',
          render: (experiment) =>
            Number.isInteger(experiment.quantum_mc_result?.circuit_depth)
              ? experiment.quantum_mc_result.circuit_depth
              : 'N/A',
        },
        {
          label: 'Classical Runtime',
          render: (experiment) => formatFixed(experiment.classical_mc_result?.runtime_ms, 2),
        },
        {
          label: 'Solution Error',
          render: (experiment) =>
            isFiniteNumber(experiment.error_quantum)
              ? `${(experiment.error_quantum * 100).toFixed(2)}%`
              : 'N/A',
        },
      ]
    },
  }
}

export const ALGORITHM_CONFIGS = {
  QMC_European: {
    label: 'European Option (QMC)',
    hasAnalyticalBaseline: true,
    resultLabels: {
      analytical: 'Black-Scholes',
      classical: 'Classical MC',
      quantum: 'Quantum MC',
    },
    summaryFields: ['stock_price', 'volatility', 'strike_price', 'n_shots', 'simulator'],
    display: createQuantumMonteCarloDisplay({ hasAnalyticalBaseline: true }),
    fields: [
      {
        name: 'stock_price',
        label: 'Stock Price ($)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 100',
        default: '',
      },
      {
        name: 'volatility',
        label: 'Volatility (0 – 1)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 0.3',
        step: '0.01',
        min: '0',
        max: '1',
        default: '',
      },
      {
        name: 'strike_price',
        label: 'Strike Price ($)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 105',
        default: '',
      },
      {
        name: 'risk_free_rate',
        label: 'Risk-Free Rate (annual)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 0.05',
        step: '0.01',
        min: '0',
        helperText: 'Enter as a decimal annual rate, for example 0.05 for 5%.',
        default: '0.05',
      },
      {
        name: 'time_to_expiry',
        label: 'Time to Expiry (years)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 1.0',
        step: '0.25',
        min: '0',
        helperText: 'Use years, so 6 months should be entered as 0.5.',
        default: '1.0',
      },
      {
        name: 'num_uncertainty_qubits',
        label: 'Uncertainty Qubits',
        type: 'select',
        dataType: 'int',
        default: '3',
        helperText: 'Higher qubit counts increase fidelity, but values above 5 should run asynchronously.',
        options: [
          { value: '3', label: '3 — fast, lower precision' },
          { value: '4', label: '4' },
          { value: '5', label: '5' },
          { value: '6', label: '6 — async recommended' },
          { value: '7', label: '7 — async recommended' },
          { value: '8', label: '8 — async recommended' },
          { value: '9', label: '9 — async recommended' },
          { value: '10', label: '10 — async required' },
        ],
      },
      {
        name: 'n_shots',
        label: 'Number of Shots',
        type: 'select',
        dataType: 'int',
        helperText: 'More shots usually reduce sampling noise but increase runtime.',
        default: '',
        options: [
          { value: '', label: 'Select shots' },
          { value: '512', label: '512' },
          { value: '1024', label: '1024' },
          { value: '2048', label: '2048' },
          { value: '4096', label: '4096' },
        ],
      },
      {
        name: 'simulator',
        label: 'Simulator',
        type: 'select',
        dataType: 'string',
        helperText: 'Use Aer for shot-based sampling and Statevector for ideal noiseless simulation.',
        default: 'aer_simulator',
        options: [
          { value: 'aer_simulator', label: 'Aer Simulator' },
          { value: 'statevector_simulator', label: 'Statevector Simulator' },
        ],
      },
    ],
  },

  QMC_Basket: {
    label: 'Basket Option (QMC)',
    hasAnalyticalBaseline: false,
    resultLabels: {
      classical: 'Classical MC',
      quantum: 'Quantum MC',
    },
    summaryFields: [
      'spot_price_1',
      'spot_price_2',
      'volatility_1',
      'volatility_2',
      'strike_price',
      'n_shots',
      'simulator',
    ],
    display: createQuantumMonteCarloDisplay({ hasAnalyticalBaseline: false }),
    fields: [
      {
        name: 'spot_price_1',
        label: 'Asset 1 Spot Price ($)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 100',
        default: '',
      },
      {
        name: 'spot_price_2',
        label: 'Asset 2 Spot Price ($)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 95',
        default: '',
      },
      {
        name: 'volatility_1',
        label: 'Asset 1 Volatility (0 – 1)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 0.25',
        step: '0.01',
        min: '0',
        max: '1',
        default: '',
      },
      {
        name: 'volatility_2',
        label: 'Asset 2 Volatility (0 – 1)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 0.30',
        step: '0.01',
        min: '0',
        max: '1',
        default: '',
      },
      {
        name: 'asset_weight_1',
        label: 'Asset 1 Weight',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 0.5',
        step: '0.01',
        min: '0',
        max: '1',
        helperText: 'Set portfolio mix as decimals, and keep both weights summing close to 1.0.',
        default: '0.5',
      },
      {
        name: 'asset_weight_2',
        label: 'Asset 2 Weight',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 0.5',
        step: '0.01',
        min: '0',
        max: '1',
        helperText: 'Set portfolio mix as decimals, and keep both weights summing close to 1.0.',
        default: '0.5',
      },
      {
        name: 'strike_price',
        label: 'Strike Price ($)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 105',
        default: '',
      },
      {
        name: 'risk_free_rate',
        label: 'Risk-Free Rate (annual)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 0.05',
        step: '0.01',
        min: '0',
        helperText: 'Enter as a decimal annual rate, for example 0.05 for 5%.',
        default: '0.05',
      },
      {
        name: 'time_to_expiry',
        label: 'Time to Expiry (years)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 1.0',
        step: '0.25',
        min: '0',
        helperText: 'Use years, so 6 months should be entered as 0.5.',
        default: '1.0',
      },
      {
        name: 'num_uncertainty_qubits',
        label: 'Uncertainty Qubits',
        type: 'select',
        dataType: 'int',
        default: '3',
        helperText: 'Higher qubit counts increase fidelity, but values above 5 should run asynchronously.',
        options: [
          { value: '3', label: '3 — fast, lower precision' },
          { value: '4', label: '4' },
          { value: '5', label: '5' },
          { value: '6', label: '6 — async recommended' },
          { value: '7', label: '7 — async recommended' },
          { value: '8', label: '8 — async recommended' },
          { value: '9', label: '9 — async recommended' },
          { value: '10', label: '10 — async required' },
        ],
      },
      {
        name: 'n_shots',
        label: 'Number of Shots',
        type: 'select',
        dataType: 'int',
        helperText: 'More shots usually reduce sampling noise but increase runtime.',
        default: '',
        options: [
          { value: '', label: 'Select shots' },
          { value: '512', label: '512' },
          { value: '1024', label: '1024' },
          { value: '2048', label: '2048' },
          { value: '4096', label: '4096' },
        ],
      },
      {
        name: 'simulator',
        label: 'Simulator',
        type: 'select',
        dataType: 'string',
        helperText: 'Use Aer for shot-based sampling and Statevector for ideal noiseless simulation.',
        default: 'aer_simulator',
        options: [
          { value: 'aer_simulator', label: 'Aer Simulator' },
          { value: 'statevector_simulator', label: 'Statevector Simulator' },
        ],
      },
    ],
  },

  QMC_Asian: {
    label: 'Asian Option (QMC)',
    hasAnalyticalBaseline: false,
    resultLabels: {
      classical: 'Classical MC',
      quantum: 'Quantum MC',
    },
    summaryFields: [
      'spot_price',
      'volatility',
      'monitoring_dates',
      'strike_price',
      'n_shots',
      'simulator',
    ],
    display: createQuantumMonteCarloDisplay({ hasAnalyticalBaseline: false }),
    fields: [
      {
        name: 'spot_price',
        label: 'Spot Price ($)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 100',
        default: '',
      },
      {
        name: 'strike_price',
        label: 'Strike Price ($)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 105',
        default: '',
      },
      {
        name: 'volatility',
        label: 'Volatility (0 – 1)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 0.3',
        step: '0.01',
        min: '0',
        max: '1',
        default: '',
      },
      {
        name: 'risk_free_rate',
        label: 'Risk-Free Rate (annual)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 0.05',
        step: '0.01',
        min: '0',
        helperText: 'Enter as a decimal annual rate, for example 0.05 for 5%.',
        default: '0.05',
      },
      {
        name: 'time_to_expiry',
        label: 'Time to Expiry (years)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 1.0',
        step: '0.25',
        min: '0',
        helperText: 'Use years, so 6 months should be entered as 0.5.',
        default: '1.0',
      },
      {
        name: 'monitoring_dates',
        label: 'Monitoring Dates',
        type: 'number',
        dataType: 'int',
        placeholder: 'e.g. 12',
        step: '1',
        min: '2',
        max: '20',
        helperText: 'This is the number of averaging observation points over the option life.',
        default: '12',
      },
      {
        name: 'num_uncertainty_qubits',
        label: 'Uncertainty Qubits',
        type: 'select',
        dataType: 'int',
        default: '3',
        helperText: 'Higher qubit counts increase fidelity, but values above 5 should run asynchronously.',
        options: [
          { value: '3', label: '3 — fast, lower precision' },
          { value: '4', label: '4' },
          { value: '5', label: '5' },
          { value: '6', label: '6 — async recommended' },
          { value: '7', label: '7 — async recommended' },
          { value: '8', label: '8 — async recommended' },
          { value: '9', label: '9 — async recommended' },
          { value: '10', label: '10 — async required' },
        ],
      },
      {
        name: 'n_shots',
        label: 'Number of Shots',
        type: 'select',
        dataType: 'int',
        helperText: 'More shots usually reduce sampling noise but increase runtime.',
        default: '',
        options: [
          { value: '', label: 'Select shots' },
          { value: '512', label: '512' },
          { value: '1024', label: '1024' },
          { value: '2048', label: '2048' },
          { value: '4096', label: '4096' },
        ],
      },
      {
        name: 'simulator',
        label: 'Simulator',
        type: 'select',
        dataType: 'string',
        helperText: 'Use Aer for shot-based sampling and Statevector for ideal noiseless simulation.',
        default: 'aer_simulator',
        options: [
          { value: 'aer_simulator', label: 'Aer Simulator' },
          { value: 'statevector_simulator', label: 'Statevector Simulator' },
        ],
      },
    ],
  },

    HHL_CFD: {
    label: 'HHL Linear Solver (CFD)',
    hasAnalyticalBaseline: false,
    resultLabels: {
      classical: 'Classical Direct Solver',
      quantum: 'Quantum HHL',
    },
    summaryFields: [
      'system_size_n',
      'condition_number',
      'sparsity',
      'epsilon_target',
      'n_shots',
      'simulator',
    ],
    display: createLinearSolverDisplay(),
    fields: [
      {
        name: 'system_size_n',
        label: 'Linear System Size N',
        type: 'select',
        dataType: 'int',
        default: '8',
        helperText: 'Start small for simulators. HHL simulation cost grows quickly.',
        options: [
          { value: '4', label: '4' },
          { value: '8', label: '8' },
          { value: '16', label: '16' },
          { value: '32', label: '32' },
        ],
      },
      {
        name: 'condition_number',
        label: 'Condition Number (kappa)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 5',
        step: '0.5',
        min: '1',
        helperText: 'Larger condition numbers generally make the linear system harder to solve.',
        default: '5',
      },
      {
        name: 'sparsity',
        label: 'Matrix Sparsity (0 – 1)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 0.1',
        step: '0.01',
        min: '0.01',
        max: '1',
        helperText: 'Use smaller values for sparser matrices and larger values for denser ones.',
        default: '0.1',
      },
      {
        name: 'rhs_seed',
        label: 'RHS / Matrix Seed',
        type: 'number',
        dataType: 'int',
        placeholder: 'e.g. 42',
        step: '1',
        min: '0',
        helperText: 'Keep the same seed to reproduce the exact same generated system.',
        default: '42',
      },
      {
        name: 'time_parameter',
        label: 'Evolution Time (t)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 1.0',
        step: '0.1',
        min: '0.1',
        helperText: 'This controls phase evolution in HHL and can affect both error and depth.',
        default: '1.0',
      },
      {
        name: 'num_clock_qubits',
        label: 'Clock Qubits',
        type: 'select',
        dataType: 'int',
        helperText: 'More clock qubits improve phase resolution but increase circuit size.',
        default: '3',
        options: [
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
          { value: '5', label: '5' },
        ],
      },
      {
        name: 'epsilon_target',
        label: 'Target Precision (epsilon)',
        type: 'number',
        dataType: 'float',
        placeholder: 'e.g. 0.05',
        step: '0.01',
        min: '0.001',
        helperText: 'Smaller epsilon asks for tighter precision and usually costs more runtime.',
        default: '0.05',
      },
      {
        name: 'n_shots',
        label: 'Number of Shots',
        type: 'select',
        dataType: 'int',
        helperText: 'More shots usually reduce sampling noise but increase runtime.',
        default: '1024',
        options: [
          { value: '512', label: '512' },
          { value: '1024', label: '1024' },
          { value: '2048', label: '2048' },
          { value: '4096', label: '4096' },
        ],
      },
      {
        name: 'simulator',
        label: 'Simulator',
        type: 'select',
        dataType: 'string',
        helperText: 'Use Aer for shot-based sampling and Statevector for ideal noiseless simulation.',
        default: 'aer_simulator',
        options: [
          { value: 'aer_simulator', label: 'Aer Simulator' },
          { value: 'statevector_simulator', label: 'Statevector Simulator' },
        ],
      },
    ],
  },

}

export function getAlgorithmConfig(algorithm) {
  return ALGORITHM_CONFIGS[algorithm] ?? null
}

export function getAlgorithmLabel(algorithm) {
  return ALGORITHM_CONFIGS[algorithm]?.label ?? algorithm
}

export function getFieldConfig(algorithm, fieldName) {
  const config = getAlgorithmConfig(algorithm)

  if (!config) {
    return null
  }

  return config.fields.find((field) => field.name === fieldName) ?? null
}

export function getSummaryFields(algorithm) {
  const config = getAlgorithmConfig(algorithm)

  if (!config) {
    return []
  }

  return config.summaryFields.map((fieldName) => {
    const field = getFieldConfig(algorithm, fieldName)

    return {
      name: fieldName,
      label: field?.label ?? fieldName,
    }
  })
}

export function getResultLabels(algorithm) {
  return (
    ALGORITHM_CONFIGS[algorithm]?.resultLabels ?? {
      classical: 'Classical Result',
      quantum: 'Quantum Result',
    }
  )
}

export function hasAnalyticalBaseline(algorithm) {
  return Boolean(ALGORITHM_CONFIGS[algorithm]?.hasAnalyticalBaseline)
}

export function getDisplayConfig(algorithm) {
  return ALGORITHM_CONFIGS[algorithm]?.display ?? createQuantumMonteCarloDisplay({ hasAnalyticalBaseline: false })
}