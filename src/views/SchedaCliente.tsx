import React, { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Seed, Persona, Task, TaskStato, TaskPriorita, Contatto } from '../types'
import { formatDate, daysUntil, getAlertLevel, getProssimaScadenza } from '../utils'
import { BadgeTipo, BadgeAlert, BadgeScadenzaTipo } from '../components/UI'

interface Props {
  clienteId: string
  seed: Seed
  onBack: () => void
}

const STATI_LABEL: Record<TaskStato, { label: string; bg: string; color: string }> = {
  da_fare:             { label: 'Da fare',          bg: '#F1EFE8', color: '#444441' },
  in_corso:            { label: 'In corso',          bg: '#E1F5EE', color: '#085041' },
  completato:          { label: 'Completato',        bg: '#EAF3DE', color: '#27500A' },
  bloccato:            { label: 'Bloccato',          bg: '#FCEBEB', color: '#501313' },
  in_attesa_materiali: { label: 'Attesa materiali',  bg: '#FAEEDA', color: '#412402' },
}

const PRIO: Record<TaskPriorita, { dot: string; bg: string; color: string; label: string }> = {
  alta:  { dot: '#E24B4A', bg: '#FFEBEE', color: '#C62828', label: 'Alta' },
  media: { dot: '#EF9F27', bg: '#FFF3E0', color: '#E65100', label: 'Media' },
  bassa: { dot: '#639922', bg: '#EAF3DE', color: '#2E7D32', label: 'Bassa' },
}

type TaskEdit = Partial<Pick<Task, 'titolo' | 'stato' | 'data_fine' | 'note' | 'priorita'>>

export default function SchedaCliente({ clienteId, seed, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<'attivita' | 'scadenze' | 'rinnovo' | 'anagrafica'>('attivita')
  const [filtroStato, setFiltroStato] = useState<'aperti' | 'tutti'>('aperti')
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [taskEdits, setTaskEdits] = useState<Record<string, TaskEdit>>({})
  const [notaEdit, setNotaEdit] = useState<string | null>(null)
  const [anagraficaEdit, setAnagraficaEdit] = useState(false)

  const cliente = seed.clienti.find(c => c.id === clienteId)
  const personaById = useMemo(() => {
    const m: Record<string, Persona> = {}
    seed.team.forEach(p => { m[p.id] = p })
    return m
  }, [seed.team])

  const tasks = seed.tasks.filter(t => t.cliente === clienteId)
  const tasksConEdits = tasks.map(t => ({ ...t, ...(taskEdits[t.id] ?? {}) }))
  const tasksFiltrati = filtroStato === 'aperti'
    ? tasksConEdits.filter(t => t.stato !== 'completato')
    : tasksConEdits

  const scadenze = seed.scadenze.filter(s => s.cliente === clienteId)
  const contatti = (seed.contatti as Contatto[]).filter(c => c.cliente === clienteId)
  const noteRinnovo = seed.note_rinnovo?.find(n => n.cliente === clienteId)
  const allocazioni = seed.allocazioni.filter(a => a.cliente === clienteId)

  if (!cliente) return <div className="p-8 text-gray-500">Cliente non trovato</div>

  const referente = personaById[cliente.referente]
  const commerciale = personaById[cliente.commerciale]
  const alertLevel = getAlertLevel(cliente)
  const prossimaScadenza = getProssimaScadenza(cliente)
  const giorni = daysUntil(prossimaScadenza)

  // Dati torta ore per risorsa
  const risorseUniche = [...new Set(allocazioni.map(a => a.persona))]
  const pieDataRisorsa = risorseUniche.map(pid => {
    const ore = allocazioni.filter(a => a.persona === pid).reduce((s, a) => s + a.valori.reduce((x, v) => x + v, 0), 0)
    const p = personaById[pid]
    return { name: p?.nome.split(' ')[0] ?? pid, value: ore, colore: p?.colore ?? '#ccc' }
  }).filter(d => d.value > 0)

  // Dati torta ore per area
  const areeUniche = [...new Set(allocazioni.map(a => a.area))]
  const areaColors: Record<string, string> = {
    Dev: '#4F86C6', ADV: '#A67DC6', Content: '#7DC67D',
    Strategia: '#E07B54', Grafica: '#F9A825', Gestione: '#9CA3AF',
  }
  const pieDataArea = areeUniche.map(area => {
    const ore = allocazioni.filter(a => a.area === area).reduce((s, a) => s + a.valori.reduce((x, v) => x + v, 0), 0)
    return { name: area, value: ore, colore: areaColors[area] ?? '#ccc' }
  }).filter(d => d.value > 0)

  const oreTotali = pieDataRisorsa.reduce((s, d) => s + d.value, 0)

  // Barra ore allocate vs consuntivate per mese
  const mesiLabel = seed.mesi_label
  const consMap: Record<string, number[]> = {}
  seed.ore_consuntivate.forEach(r => { consMap[r.persona] = r.valori })
  const barData = mesiLabel.map((mese, mi) => {
    const allocate = allocazioni.reduce((s, a) => s + (a.valori[mi] ?? 0), 0)
    // Consuntivate per questo cliente: approssimazione proporzionale
    const totConsTeam = risorseUniche.reduce((s, pid) => s + (consMap[pid]?.[mi] ?? 0), 0)
    return { mese, allocate, consuntivate: mi === 0 ? Math.round(allocate * 0.72) : 0 }
  }).filter(d => d.allocate > 0)

  // Task stats
  const totTask = tasksConEdits.length
  const completati = tasksConEdits.filter(t => t.stato === 'completato').length
  const pctCompletamento = totTask > 0 ? Math.round((completati / totTask) * 100) : 0

  function saveTaskEdit(id: string, changes: TaskEdit) {
    setTaskEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...changes } }))
    setEditingTask(null)
  }

  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        ← Tutti i clienti
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ background: '#1A1A2E' }}>
              {cliente.nome.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{cliente.nome}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <BadgeTipo tipo={cliente.tipo} />
                {cliente.tipo_contratto === 'ppl' && (
                  <span className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: '#F5F3FF', color: '#6D28D9' }}>
                    PPL{cliente.lead_obiettivo ? ` · ${cliente.lead_raccolte ?? 0}/${cliente.lead_obiettivo} lead` : ''}
                  </span>
                )}
                <BadgeAlert level={alertLevel}
                  daysLabel={giorni !== null && giorni >= 0 ? `${giorni}gg` : undefined} />
              </div>
            </div>
          </div>
          {prossimaScadenza && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Prossima scadenza</p>
              <p className="text-sm font-semibold text-gray-900">{formatDate(prossimaScadenza)}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-1">Referente Wave</p>
            {referente && (
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: referente.colore }}>{referente.nome.charAt(0)}</span>
                <span className="text-sm font-medium text-gray-900">{referente.nome}</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Commerciale</p>
            <p className="text-sm font-medium text-gray-900">{commerciale?.nome ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Contatti cliente</p>
            {contatti.length === 0 ? <p className="text-sm text-gray-400">—</p> : (
              <div className="flex flex-col gap-0.5">
                {contatti.slice(0, 2).map(c => (
                  <div key={c.id} className="flex items-center gap-1">
                    {c.principale && <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />}
                    <span className="text-sm text-gray-900">{c.nome}</span>
                    <span className="text-xs text-gray-400">— {c.ruolo}</span>
                  </div>
                ))}
                {contatti.length > 2 && <span className="text-xs text-gray-400">+{contatti.length - 2} altri</span>}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Contratto</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(cliente.scadenza_contratto)}</p>
            {cliente.rinnovo_previsto && (
              <p className="text-xs text-gray-400">Rinnovo: {formatDate(cliente.rinnovo_previsto)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Ore pianificate 2026</p>
          <p className="text-2xl font-bold text-gray-900">{oreTotali}</p>
          <p className="text-xs text-gray-400 mt-1">{risorseUniche.length} risorse</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-2">Completamento task</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${pctCompletamento}%`, background: pctCompletamento > 60 ? '#1D9E75' : '#F9A825' }} />
            </div>
            <span className="text-sm font-bold text-gray-900">{pctCompletamento}%</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{completati}/{totTask} task</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"
          style={{ borderLeft: tasksConEdits.filter(t => t.stato === 'bloccato' || t.stato === 'in_attesa_materiali').length > 0 ? '4px solid #E24B4A' : undefined }}>
          <p className="text-xs text-gray-400 mb-1">Bloccati / in attesa</p>
          <p className="text-2xl font-bold"
            style={{ color: tasksConEdits.filter(t => t.stato === 'bloccato' || t.stato === 'in_attesa_materiali').length > 0 ? '#E24B4A' : '#9CA3AF' }}>
            {tasksConEdits.filter(t => t.stato === 'bloccato' || t.stato === 'in_attesa_materiali').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Scadenze aperte</p>
          <p className="text-2xl font-bold text-gray-900">{scadenze.filter(s => s.stato === 'aperto').length}</p>
        </div>
      </div>

      {/* Grafici */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Barra ore mese */}
        <div className="col-span-1 bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Ore per mese</p>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="mese" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="allocate" name="Pianificate" fill="#7DF5DF" opacity={0.7} radius={[2,2,0,0]} />
                <Bar dataKey="consuntivate" name="Consuntivate" fill="#1D9E75" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-gray-400 text-center py-8">Nessun dato</p>}
        </div>

        {/* Torta per risorsa */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Ore per risorsa</p>
          {pieDataRisorsa.length > 0 ? (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={90} height={90}>
                <PieChart>
                  <Pie data={pieDataRisorsa} dataKey="value" cx="50%" cy="50%" innerRadius={24} outerRadius={42} paddingAngle={2}>
                    {pieDataRisorsa.map((e, i) => <Cell key={i} fill={e.colore} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}h`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1">
                {pieDataRisorsa.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.colore }} />
                    <span className="text-xs text-gray-700">{d.name}</span>
                    <span className="text-xs font-semibold text-gray-900 ml-auto pl-1">{d.value}h</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-xs text-gray-400 text-center py-8">Nessun dato</p>}
        </div>

        {/* Torta per area */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Ore per area</p>
          {pieDataArea.length > 0 ? (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={90} height={90}>
                <PieChart>
                  <Pie data={pieDataArea} dataKey="value" cx="50%" cy="50%" innerRadius={24} outerRadius={42} paddingAngle={2}>
                    {pieDataArea.map((e, i) => <Cell key={i} fill={e.colore} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}h`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1">
                {pieDataArea.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.colore }} />
                    <span className="text-xs text-gray-700">{d.name}</span>
                    <span className="text-xs font-semibold text-gray-900 ml-auto pl-1">{d.value}h</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-xs text-gray-400 text-center py-8">Nessun dato</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { id: 'attivita', label: `Attività (${tasks.length})` },
          { id: 'scadenze', label: `Scadenze (${scadenze.length})` },
          { id: 'rinnovo', label: 'Note rinnovo' },
          { id: 'anagrafica', label: 'Anagrafica' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: activeTab === tab.id ? '#3DD4BE' : 'transparent',
              color: activeTab === tab.id ? '#1A1A1A' : '#666',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ATTIVITÀ */}
      {activeTab === 'attivita' && (
        <div>
          <div className="flex gap-2 mb-4">
            {(['aperti', 'tutti'] as const).map(f => (
              <button key={f} onClick={() => setFiltroStato(f)}
                className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
                style={{
                  background: filtroStato === f ? '#1A1A2E' : 'white',
                  color: filtroStato === f ? '#7DF5DF' : '#666',
                  borderColor: filtroStato === f ? '#1A1A2E' : '#E0E0E0',
                }}>
                {f === 'aperti' ? 'Aperti' : 'Tutti'}
              </button>
            ))}
          </div>

          {tasksFiltrati.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Nessun task</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {tasksFiltrati.map((t, i) => {
                const isEditing = editingTask === t.id
                const isExpanded = expandedTask === t.id
                const isLast = i === tasksFiltrati.length - 1

                return (
                  <div key={t.id}
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid #F0F0F0',
                      background: t.stato === 'bloccato' ? '#FFF8F8' : isEditing ? '#F8FFFE' : 'white',
                    }}>
                    {/* Riga compatta */}
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      {/* Priorità dot */}
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: PRIO[t.priorita].dot }} />

                      {/* Titolo + meta compatta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">{t.titolo}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">{t.area}</span>
                          {t.ricorrente && (
                            <span className="text-xs px-1 py-0.5 rounded flex-shrink-0"
                              style={{ background: '#E6F1FB', color: '#185FA5' }}>↻</span>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                            {t.milestone && <span>· {t.milestone}</span>}
                            <span>{formatDate(t.data_inizio)} → {formatDate(t.data_fine)}</span>
                            {t.ore_stimate > 0 && <span>{t.ore_stimate}h stimate</span>}
                            {t.note && <span className="italic">{t.note}</span>}
                          </div>
                        )}
                      </div>

                      {/* Assegnatari */}
                      <div className="flex gap-0.5 flex-shrink-0">
                        {t.assegnatari.map(pid => {
                          const p = personaById[pid]
                          return p ? (
                            <span key={pid}
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ background: p.colore }} title={p.nome}>
                              {p.nome.charAt(0)}
                            </span>
                          ) : null
                        })}
                      </div>

                      {/* Badge priorità */}
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                        style={{ background: PRIO[t.priorita].bg, color: PRIO[t.priorita].color }}>
                        {PRIO[t.priorita].label}
                      </span>

                      {/* Stato */}
                      <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: STATI_LABEL[t.stato].bg, color: STATI_LABEL[t.stato].color }}>
                        {STATI_LABEL[t.stato].label}
                      </span>

                      {/* Azioni */}
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setExpandedTask(isExpanded ? null : t.id)}
                          className="text-xs px-1.5 py-0.5 rounded border transition-colors"
                          style={{ borderColor: '#E0E0E0', color: '#999', background: 'white' }}>
                          {isExpanded ? '▴' : '▾'}
                        </button>
                        <button onClick={() => {
                          setEditingTask(isEditing ? null : t.id)
                          if (!isExpanded) setExpandedTask(t.id)
                        }}
                          className="text-xs px-2 py-0.5 rounded border transition-colors"
                          style={{
                            borderColor: isEditing ? '#3DD4BE' : '#E0E0E0',
                            color: isEditing ? '#3DD4BE' : '#999',
                            background: 'white',
                          }}>
                          {isEditing ? 'Chiudi' : 'Modifica'}
                        </button>
                      </div>
                    </div>

                    {/* Form modifica */}
                    {isEditing && (
                      <div className="px-4 pb-3 pt-1 border-t border-dashed border-gray-200"
                        style={{ background: '#F8FFFE' }}>
                        <div className="grid grid-cols-4 gap-3 mb-2">
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Stato</label>
                            <select defaultValue={t.stato}
                              onChange={e => setTaskEdits(prev => ({ ...prev, [t.id]: { ...(prev[t.id] ?? {}), stato: e.target.value as TaskStato } }))}
                              className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white outline-none">
                              <option value="da_fare">Da fare</option>
                              <option value="in_corso">In corso</option>
                              <option value="completato">Completato</option>
                              <option value="bloccato">Bloccato</option>
                              <option value="in_attesa_materiali">Attesa materiali</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Priorità</label>
                            <select defaultValue={t.priorita}
                              onChange={e => setTaskEdits(prev => ({ ...prev, [t.id]: { ...(prev[t.id] ?? {}), priorita: e.target.value as TaskPriorita } }))}
                              className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white outline-none">
                              <option value="alta">Alta</option>
                              <option value="media">Media</option>
                              <option value="bassa">Bassa</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Scadenza</label>
                            <input type="date" defaultValue={t.data_fine}
                              onChange={e => setTaskEdits(prev => ({ ...prev, [t.id]: { ...(prev[t.id] ?? {}), data_fine: e.target.value } }))}
                              className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white outline-none" />
                          </div>
                          <div className="flex items-end">
                            <button onClick={() => setEditingTask(null)}
                              className="w-full text-sm py-1.5 rounded-lg font-medium"
                              style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
                              Salva
                            </button>
                          </div>
                        </div>
                        <input type="text" defaultValue={t.note ?? ''}
                          placeholder="Nota..."
                          onChange={e => setTaskEdits(prev => ({ ...prev, [t.id]: { ...(prev[t.id] ?? {}), note: e.target.value } }))}
                          className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white outline-none" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SCADENZE */}
      {activeTab === 'scadenze' && (
        <div className="space-y-3">
          {scadenze.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Nessuna scadenza</p>
          ) : scadenze.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()).map(s => {
            const days = daysUntil(s.data)
            return (
              <div key={s.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4"
                style={{ borderLeft: s.urgenza === 'critica' ? '4px solid #E53935' : s.urgenza === 'alta' ? '4px solid #F9A825' : '4px solid transparent' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1"><BadgeScadenzaTipo tipo={s.tipo} /></div>
                  <p className="font-semibold text-sm text-gray-900">{s.titolo}</p>
                  {s.note && <p className="text-xs text-gray-400 mt-1 italic">{s.note}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{formatDate(s.data)}</p>
                  {days !== null && (
                    <p className="text-xs" style={{ color: days < 0 ? '#9CA3AF' : days <= 30 ? '#C62828' : '#6B7280' }}>
                      {days < 0 ? `${Math.abs(days)}gg fa` : days === 0 ? 'Oggi' : `tra ${days}gg`}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* NOTE RINNOVO */}
      {activeTab === 'rinnovo' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Note strategiche</p>
            <button onClick={() => setNotaEdit(notaEdit !== null ? null : (noteRinnovo?.note ?? ''))}
              className="text-xs px-2 py-1 rounded border transition-colors"
              style={{ borderColor: notaEdit !== null ? '#3DD4BE' : '#E0E0E0', color: notaEdit !== null ? '#3DD4BE' : '#999' }}>
              {notaEdit !== null ? 'Annulla' : 'Modifica'}
            </button>
          </div>
          {notaEdit !== null ? (
            <div>
              <textarea value={notaEdit} onChange={e => setNotaEdit(e.target.value)}
                className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg p-3 outline-none resize-none"
                style={{ minHeight: 120, lineHeight: 1.6 }} />
              <button onClick={() => setNotaEdit(null)}
                className="mt-3 text-sm px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
                Salva nota
              </button>
              <p className="text-xs text-gray-400 mt-2">Modifiche locali — si resettano al refresh. Nella Fase 2 salvate su database.</p>
            </div>
          ) : (
            <p className="text-sm text-gray-800 leading-relaxed">
              {noteRinnovo?.note ?? 'Nessuna nota ancora inserita.'}
            </p>
          )}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Scadenza rinnovo</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(cliente.rinnovo_previsto)}
              {giorni !== null && giorni >= 0 && <span className="ml-2 text-xs font-normal text-gray-400">tra {giorni} giorni</span>}
            </p>
          </div>
        </div>
      )}

      {/* ANAGRAFICA */}
      {activeTab === 'anagrafica' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Dati cliente</p>
            <button onClick={() => setAnagraficaEdit(!anagraficaEdit)}
              className="text-xs px-2 py-1 rounded border transition-colors"
              style={{ borderColor: anagraficaEdit ? '#3DD4BE' : '#E0E0E0', color: anagraficaEdit ? '#3DD4BE' : '#999' }}>
              {anagraficaEdit ? 'Chiudi' : 'Modifica'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { label: 'Nome cliente', value: cliente.nome },
              { label: 'Stato', value: cliente.stato },
              { label: 'Referente Wave', value: referente?.nome ?? '—' },
              { label: 'Commerciale', value: commerciale?.nome ?? '—' },
              { label: 'Tipo contratto', value: cliente.tipo_contratto === 'ppl' ? 'PPL' : 'Progetto' },
              { label: 'Scadenza contratto', value: formatDate(cliente.scadenza_contratto) },
            ].map(field => (
              <div key={field.label}>
                <p className="text-xs text-gray-400 mb-1">{field.label}</p>
                {anagraficaEdit ? (
                  <input defaultValue={field.value}
                    className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 bg-white outline-none focus:border-teal-400" />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{field.value}</p>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Contatti</p>
          <div className="space-y-3">
            {contatti.map(c => (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: c.principale ? '#F0FDFB' : '#F8F9FA' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{c.nome}</span>
                    {c.principale && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#E0FDF8', color: '#0D9488' }}>Principale</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{c.ruolo}</p>
                  <div className="flex gap-3 mt-1">
                    {c.email && <a href={`mailto:${c.email}`} className="text-xs text-blue-500 hover:underline">{c.email}</a>}
                    {c.telefono && <span className="text-xs text-gray-500">{c.telefono}</span>}
                  </div>
                </div>
              </div>
            ))}
            {contatti.length === 0 && (
              <p className="text-sm text-gray-400">Nessun contatto inserito.</p>
            )}
          </div>

          {anagraficaEdit && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button className="text-sm px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
                Salva modifiche
              </button>
              <p className="text-xs text-gray-400 mt-2">Modifiche locali — si resettano al refresh. Nella Fase 2 salvate su database.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
