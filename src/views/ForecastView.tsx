import React from 'react'

export default function ForecastView() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Forecast</h1>
        <span className="text-xs px-3 py-1.5 rounded-full font-medium"
          style={{ background: '#E0FDF8', color: '#0D9488' }}>
          In sviluppo
        </span>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Vista Forecast</h2>
        <p className="text-sm text-gray-500 max-w-md leading-relaxed">
          Qui vedremo la capacita futura del team incrociata con i progetti attivi,
          i rinnovi previsti e i prospect in pipeline.
        </p>
      </div>
    </div>
  )
}
