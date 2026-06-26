import React, { useState } from 'react'
import { Seed, Cliente, TipoContratto, ClienteStato } from '../types'

interface Props {
  seed: Seed
  onClose: () => void
  onSave: (cliente: Cliente) => void
}

export default function NuovoClienteModal({ seed, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    nome: '',
    referente: seed.team.find(p => p.tipo === 'operativo')?.id ?? '',
    commerciale: seed.team.find(p => p.tipo === 'commerciale')?.id ?? '',
    stato: 'attivo' as ClienteStato,
    tipo_contratto: 'progetto' as TipoContratto,
    scadenza_contratto: '',
    rinnovo_previsto: '',
    lead_obiettivo: '',
    note: '',
  })
  const [error, setError] = useState('')

  const operativi = seed.team.filter(p => p.tipo === 'operativo')
  const commerciali = seed.team.filter(p => p.tipo === 'commerciale')

  function handleSave() {
    if (!form.nome.trim()) { setError('Il nome cliente è obbligatorio'); return }
    if (!form.referente) { setError('Seleziona un referente Wave'); return }
    if (!form.commerciale) { setError('Seleziona un commerciale'); return }

    const nuovoCliente: Cliente = {
      id: form.nome.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now(),
      nome: form.nome.trim(),
      stato: form.stato,
      tipo: 'nuovo',
      tipo_contratto: form.tipo_contratto,
      referente: form.referente,
      commerciale: form.commerciale,
      scadenza_contratto: form.scadenza_contratto || null,
      rinnovo_previsto: form.rinnovo_previsto || null,
      lead_obiettivo: form.tipo_contratto === 'ppl' && form.lead_obiettivo ? Number(form.lead_obiettivo) : null,
      lead_raccolte: null,
      note: form.note || undefined,
    }
    onSave(nuovoCliente)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
          style={{ background: '#F8F9FA' }}>
          <h2 className="text-base font-semibold text-gray-900">Nuovo cliente</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4 max-h-96 overflow-y-auto">
          {error && (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#FFEBEE', color: '#C62828' }}>
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Nome cliente *</label>
            <input value={form.nome} onChange={e => { setForm(f => ({ ...f, nome: e.target.value })); setError('') }}
              placeholder="Es. Acme S.r.l."
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Referente Wave *</label>
              <select value={form.referente} onChange={e => setForm(f => ({ ...f, referente: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none bg-white">
                <option value="">Seleziona</option>
                {operativi.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Commerciale *</label>
              <select value={form.commerciale} onChange={e => setForm(f => ({ ...f, commerciale: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none bg-white">
                <option value="">Seleziona</option>
                {commerciali.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Stato</label>
              <select value={form.stato} onChange={e => setForm(f => ({ ...f, stato: e.target.value as ClienteStato }))}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none bg-white">
                <option value="attivo">Attivo</option>
                <option value="in_attesa">In attesa</option>
                <option value="pausa">Pausa</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Tipo contratto</label>
              <select value={form.tipo_contratto} onChange={e => setForm(f => ({ ...f, tipo_contratto: e.target.value as TipoContratto }))}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none bg-white">
                <option value="progetto">Progetto</option>
                <option value="ppl">PPL</option>
              </select>
            </div>
          </div>

          {form.tipo_contratto === 'ppl' && (
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Lead obiettivo</label>
              <input type="number" value={form.lead_obiettivo}
                onChange={e => setForm(f => ({ ...f, lead_obiettivo: e.target.value }))}
                placeholder="Es. 100"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Scadenza contratto</label>
              <input type="date" value={form.scadenza_contratto}
                onChange={e => setForm(f => ({ ...f, scadenza_contratto: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Rinnovo previsto</label>
              <input type="date" value={form.rinnovo_previsto}
                onChange={e => setForm(f => ({ ...f, rinnovo_previsto: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Note</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={2} placeholder="Note opzionali..."
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between"
          style={{ background: '#F8F9FA' }}>
          <p className="text-xs text-gray-400">Il cliente viene aggiunto nella sessione corrente</p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
              Annulla
            </button>
            <button onClick={handleSave}
              className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
              style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
              Crea cliente
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
