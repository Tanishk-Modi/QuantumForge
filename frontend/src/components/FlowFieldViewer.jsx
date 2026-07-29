import { useMemo, useState } from 'react'

function colorForValue(value, min, max) {
  if (!Number.isFinite(value) || max <= min) {
    return 'rgb(200, 200, 200)'
  }
  const t = (value - min) / (max - min)
  const r = Math.round(30 + t * 200)
  const g = Math.round(60 + (1 - Math.abs(t - 0.5) * 2) * 120)
  const b = Math.round(220 - t * 180)
  return `rgb(${r}, ${g}, ${b})`
}

function FieldPanel({ title, fields, showPressure, showVectors }) {
  const xValues = fields?.x ?? []
  const yValues = fields?.y ?? []
  const magnitudes = fields?.velocity_magnitude ?? []
  const uValues = fields?.u ?? []
  const vValues = fields?.v ?? []
  const pValues = fields?.p ?? []

  const bounds = useMemo(() => {
    if (xValues.length === 0) {
      return null
    }
    return {
      xmin: Math.min(...xValues),
      xmax: Math.max(...xValues),
      ymin: Math.min(...yValues),
      ymax: Math.max(...yValues),
    }
  }, [xValues, yValues])

  const scalarValues = showPressure ? pValues : magnitudes
  const scalarMin = scalarValues.length ? Math.min(...scalarValues) : 0
  const scalarMax = scalarValues.length ? Math.max(...scalarValues) : 1

  if (!bounds || xValues.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h4 className="mb-2 text-sm font-semibold">{title}</h4>
        <p className="text-sm text-gray-500">No field data available.</p>
      </div>
    )
  }

  const width = 280
  const height = 280
  const pad = 20
  const scaleX = (x) =>
    pad + ((x - bounds.xmin) / (bounds.xmax - bounds.xmin || 1)) * (width - 2 * pad)
  const scaleY = (y) =>
    height - pad - ((y - bounds.ymin) / (bounds.ymax - bounds.ymin || 1)) * (height - 2 * pad)

  return (
    <div className="rounded-lg border p-4">
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-sm">
        {xValues.map((x, index) => (
          <circle
            key={`${title}-${index}`}
            cx={scaleX(x)}
            cy={scaleY(yValues[index])}
            r={showVectors ? 4 : 5}
            fill={colorForValue(scalarValues[index], scalarMin, scalarMax)}
            opacity={0.9}
          />
        ))}
        {showVectors &&
          xValues.map((x, index) => {
            const u = uValues[index] ?? 0
            const v = vValues[index] ?? 0
            const cx = scaleX(x)
            const cy = scaleY(yValues[index])
            const maxArrow = 18
            const mag = Math.hypot(u, v) || 1
            const dx = (u / mag) * maxArrow
            const dy = -(v / mag) * maxArrow
            return (
              <line
                key={`${title}-vec-${index}`}
                x1={cx}
                y1={cy}
                x2={cx + dx}
                y2={cy + dy}
                stroke="#111827"
                strokeWidth={1}
              />
            )
          })}
      </svg>
      <p className="mt-2 text-xs text-gray-500">
        {showPressure ? 'Pressure field' : 'Velocity magnitude'} · min {scalarMin.toFixed(3)} · max{' '}
        {scalarMax.toFixed(3)}
      </p>
    </div>
  )
}

function FlowFieldViewer({ classicalResult, quantumResult }) {
  const [showPressure, setShowPressure] = useState(false)
  const [showVectors, setShowVectors] = useState(true)

  return (
    <div className="mt-8 rounded-lg border p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Flow Field Visualization</h3>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showVectors}
              onChange={(event) => setShowVectors(event.target.checked)}
            />
            Velocity vectors
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showPressure}
              onChange={(event) => setShowPressure(event.target.checked)}
            />
            Show pressure
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FieldPanel
          title="Classical FVM"
          fields={classicalResult?.fields}
          showPressure={showPressure}
          showVectors={showVectors}
        />
        <FieldPanel
          title="Quantum HHL"
          fields={quantumResult?.fields}
          showPressure={showPressure}
          showVectors={showVectors}
        />
      </div>
    </div>
  )
}

export default FlowFieldViewer
