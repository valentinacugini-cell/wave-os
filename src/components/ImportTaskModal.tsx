import React from 'react'

interface ImportTaskModalProps {
  onClose: () => void
  seed?: any
}

// Import legacy disabilitato in Fase 2B
// Il componente viene mantenuto come riferimento per l'import v2
export default function ImportTaskModal({ onClose }: ImportTaskModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="text-3xl mb-3">🚧</div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Import task in aggiornamento</h3>
        <p className="text-sm text-gray-500 mb-4">
          L'import Excel è in aggiornamento al nuovo modello Wave OS.<br />
          Sarà disponibile nella prossima versione.
        </p>
        <button onClick={onClose}
          className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600">
          Chiudi
        </button>
      </div>
    </div>
  )
}
