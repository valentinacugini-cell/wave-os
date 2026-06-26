import React, { useState } from 'react'
import { Task, TaskStato, TaskPriorita, Persona, Progetto } from '../types'
import { formatDate } from '../utils'

interface TaskModalProps {
  task: Task
  personaById: Record<string, Persona>
  clienteNome: string
  progetti: Progetto[]
  onClose: () => void
  onSave: (taskId: string, updates: Partial<Task>) => void
}

const STATI: { value: TaskStato; label: string; bg: string; color: string }[] = [
  { value: 'da_fare', label: 'Da fare', bg: '#F1EFE8', color: '#444441' },
  { value: 'in_corso', label: 'In corso', bg: '#E1F5EE', color: '#085041' },
  { value: 'completato', label: 'Completato', bg: '#EAF3DE', color: '#27500A' },
  { value: 'bloccato', label: 'Bloccato', bg: '#FCEBEB', color: '#501313' },
  { value: 'in_attesa_materiali', label: 'Attesa materiali', bg: '#FAEEDA', color: '#412402' },
]

const PRIORITA: { value: TaskPriorita; label: string; color: string; bg: string }[] = [
  { value: 'alta', label: 'Alta', color: '#C62828', bg: '#FFEBEE' },
  { value: 'media', label: 'Media', color: '#E65100', bg: '#FFF3E0' },
  { value: 'bassa', label: 'Bassa', color: '#2E7D32', bg: '#EAF3DE' },
]

export default function TaskModal({ task, personaById, clienteNome, progetti, onClose, onSave }: TaskModalProps) {
  const STATI_VALIDI: TaskStato[] = ['da_fare','in_corso','completato','bloccato','in_attesa_materiali']
  const PRIO_VALIDE: TaskPriorita[] = ['alta','media','bassa']
  const safeStato = (s: string): TaskStato => STATI_VALIDI.includes(s as TaskStato) ? s as TaskStato : 'da_fare'
  const safePrio = (p: string): TaskPriorita => PRIO_VALIDE.includes(p as TaskPriorita) ? p as TaskPriorita : 'media'

  const [form, setForm] = useState({
    titolo: task.titolo ?? '',
    stato: safeStato(task.stato ?? ''),
    priorita: safePrio(task.priorita ?? ''),
    data_inizio: task.data_inizio,
    data_fine: task.data_fine,
    area: task.area,
    milestone: task.milestone ?? '',
    ore_stimate: task.ore_stimate,
    note: task.note ?? '',
    assegnatari: [...task.assegnatari],
    progetto_id: task.progetto_id ?? '',
  })

  const operativi = Object.values(personaById).filter(p => p.tipo === 'operativo')

  function toggleAssegnatario(id: string) {
    setForm(f => ({
      ...f,
      assegnatari: f.assegnatari.includes(id)
        ? f.assegnatari.filter(a => a !== id)
        : [...f.assegnatari, id]
    }))
  }

  function handleSave() {
    onSave(task.id, {
      titolo: form.titolo,
      stato: form.stato,
      priorita: form.priorita,
      data_inizio: form.data_inizio,
      data_fine: form.data_fine,
      area: form.area,
      milestone: form.milestone || null,
      ore_stimate: Number(form.ore_stimate),
      note: form.note || null,
      assegnatari: form.assegnatari,
      progetto_id: form.progetto_id || null,
    })
    onClose()
  }

  const statoInfo = STATI.find(s => s.value === form.stato)!
  const prioInfo = PRIORITA.find(p => p.value === form.priorita)!

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
          style={{ background: '#F8F9FA' }}>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">
            {clienteNome}
            {progetti.find(p => p.id === form.progetto_id) && (
              <span> · {progetti.find(p => p.id === form.progetto_id)?.nome}</span>
            )}
            {' · '}{task.area}
          </p>
            <h2 className="text-base font-semibold text-gray-900">{form.titolo}</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
            ✕
          </button>
        </div>

        {/* Stato + Priorità rapidi */}
        <div className="px-6 py-3 flex gap-2 border-b border-gray-100">
          {STATI.map(s => (
            <button key={s.value} onClick={() => setForm(f => ({ ...f, stato: s.value }))}
              className="text-xs px-2 py-1 rounded-lg font-medium transition-all"
              style={{
                background: form.stato === s.value ? s.bg : '#F1F5F9',
                color: form.stato === s.value ? s.color : '#94A3B8',
                border: form.stato === s.value ? `1.5px solid ${s.color}40` : '1.5px solid transparent',
              }}>
              {s.label}
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            {PRIORITA.map(p => (
              <button key={p.value} onClick={() => setForm(f => ({ ...f, priorita: p.value }))}
                className="text-xs px-2 py-1 rounded-lg font-medium transition-all"
                style={{
                  background: form.priorita === p.value ? p.bg : '#F1F5F9',
                  color: form.priorita === p.value ? p.color : '#94A3B8',
                  border: form.priorita === p.value ? `1.5px solid ${p.color}40` : '1.5px solid transparent',
                }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Titolo</label>
            <input value={form.titolo} onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
          </div>

          {/* Progetto */}
          {progetti.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 block mb-1">Progetto</label>
              <select value={form.progetto_id} onChange={e => setForm(f => ({ ...f, progetto_id: e.target.value }))}
                className="w-full text-sm px-2 py-1.5 rounded-lg border border-gray-200 outline-none bg-white">
                <option value="">Nessun progetto</option>
                {progetti.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Area</label>
              <input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Data inizio</label>
              <input type="date" value={form.data_inizio} onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))}
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Data fine</label>
              <input type="date" value={form.data_fine} onChange={e => setForm(f => ({ ...f, data_fine: e.target.value }))}
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Milestone</label>
              <input value={form.milestone} onChange={e => setForm(f => ({ ...f, milestone: e.target.value }))}
                placeholder="Opzionale"
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Ore stimate</label>
              <input type="number" value={form.ore_stimate} onChange={e => setForm(f => ({ ...f, ore_stimate: Number(e.target.value) }))}
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Assegnatari</label>
            <div className="flex gap-2 flex-wrap">
              {operativi.map(p => (
                <button key={p.id} onClick={() => toggleAssegnatario(p.id)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all"
                  style={{
                    background: form.assegnatari.includes(p.id) ? p.colore + '22' : '#F1F5F9',
                    border: form.assegnatari.includes(p.id) ? `1.5px solid ${p.colore}` : '1.5px solid transparent',
                    color: form.assegnatari.includes(p.id) ? '#1A1A1A' : '#94A3B8',
                  }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: p.colore }}>{p.nome.charAt(0)}</span>
                  {p.nome.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Note</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={2} placeholder="Aggiungi una nota..."
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between"
          style={{ background: '#F8F9FA' }}>
          <p className="text-xs text-gray-400">
            Modifiche locali — salvate nella sessione corrente
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
              Annulla
            </button>
            <button onClick={handleSave}
              className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
              style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
              Salva task
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
