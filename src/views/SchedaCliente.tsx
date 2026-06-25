import React, { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Seed, Persona, Task, TaskStato, TaskPriorita } from '../types'
import { formatDate, daysUntil, getAlertLevel, getProssimaScadenza } from '../utils'
import { BadgeTipo, BadgeAlert, BadgeScadenzaTipo } from '../components/UI'

interface SchedaClienteProps {
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

const PRIO_DOT: Record<TaskPriorita, string> = {
  alta: '#E24B4A', media: '#EF9F27', bassa: '#639922'
}

type TaskEdit = Partial<Pick<Task, 'titolo' | 'stato' | 'data_fine' | 'note' | 'priorita'>>

export default function SchedaCliente({ clienteId, seed, onBack }: SchedaClienteProps) {
  const [activeTab, setActiveTab] = useState<'attivita' | 'scadenze' | 'rinnovo'>('attivita')
  const [filtroStato, setFiltroStato] = useState<'aperti' | 'tutti'>('aperti')
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [taskEdits, setTaskEdits] = useState<Record<string, TaskEdit>>({})
  const [notaEdit, setNotaEdit] = useState<string | null>(null)

  const cliente = useMemo(() => seed.clienti.find(c => c.id === clienteId), [seed.clienti, clienteId])

  const personaById = useMemo(() => {
    const m: Record<string, Persona> = {}
    seed.team.forEach(p => { m[p.id] = p })
    return m
  }, [seed.team])

  const tasks = useMemo(() =>
    seed.tasks.filter(t => t.cliente === clienteId)
  , [seed.tasks, clienteId])

  const tasksConEdits = useMemo(() =>
    tasks.map(t => ({ ...t, ...(taskEdits[t.id] ?? {}) }))
  , [tasks, taskEdits])

  const tasksFiltrati = useMemo(() => {
    if (filtroStato === 'aperti') return tasksConEdits.filter(t => t.stato !== 'completato')
    return tasksConEdits
  }, [tasksConEdits, filtroStato])

  const scadenze = useMemo(() =>
    seed.scadenze.filter(s => s.cliente === clienteId)
  , [seed.scadenze, clienteId])

  const contatto = useMemo(() =>
    seed.contatti?.find(c => c.cliente === clienteId)
  , [seed.contatti, clienteId])

  const noteRinnovoBase = useMemo(() =>
    seed.note_rinnovo?.find(n => n.cliente === clienteId)
  , [seed.note_rinnovo, clienteId])

  const allocazioni = useMemo(() =>
    seed.allocazioni.filter(a => a.cliente === clienteId)
  , [seed.allocazioni, clienteId])

  if (!cliente) return <div className="p-8 text-gray-500">Cliente non trovato</div>

  const referente = personaById[cliente.referente]
  const commerciale = personaById[cliente.commerciale]
  const alertLevel = getAlertLevel(cliente)
  const prossimaScadenza = getProssimaScadenza(cliente)
  const giorni = daysUntil(prossimaScadenza)

  const risorseUniche = [...new Set(allocazioni.map(a => a.persona))]
  const pieData = risorseUniche.map(pid => {
    const ore = allocazioni
      .filter(a => a.persona === pid)
      .reduce((sum, a) => sum + a.valori.reduce((s, v) => s + v, 0), 0)
    const p = personaById[pid]
    return { name: p?.nome.split(' ')[0] ?? pid, value: ore, colore: p?.colore ?? '#ccc' }
  }).filter(d => d.value > 0)

  const oreTotali = pieData.reduce((s, d) => s + d.value, 0)
  const taskDaFare = tasksConEdits.filter(t => t.stato === 'da_fare').length
  const taskInCorso = tasksConEdits.filter(t => t.stato === 'in_corso').length
  const taskCompletati = tasksConEdits.filter(t => t.stato === 'completato').length
  const taskBloccati = tasksConEdits.filter(t => t.stato === 'bloccato' || t.stato === 'in_attesa_materiali').length

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
            <p className="text-xs text-gray-400 mb-1">Contatto cliente</p>
            <p className="text-sm font-medium text-gray-900">{contatto?.nome ?? '—'}</p>
            {contatto?.ruolo && <p className="text-xs text-gray-400">{contatto.ruolo}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Contratto</p>
            <p className="text-sm font-medium text-gray-900">
              {cliente.scadenza_contratto ? formatDate(cliente.scadenza_contratto) : '—'}
            </p>
            {cliente.rinnovo_previsto && (
              <p className="text-xs text-gray-400">Rinnovo: {formatDate(cliente.rinnovo_previsto)}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="col-span-3 grid grid-cols-4 gap-3">
          {[
            { label: 'Ore pianificate', value: oreTotali, sub: `${risorseUniche.length} risorse`, accent: undefined },
            { label: 'Task aperti', value: taskDaFare + taskInCorso, sub: `${taskDaFare} da fare · ${taskInCorso} in corso`, accent: undefined },
            { label: 'Completati', value: taskCompletati, sub: '', accent: '#1D9E75' },
            { label: 'Bloccati', value: taskBloccati, sub: '', accent: taskBloccati > 0 ? '#E24B4A' : undefined },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4"
              style={{ borderLeft: s.accent ? `4px solid ${s.accent}` : undefined }}>
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.accent ?? '#1A1A1A' }}>{s.value}</p>
              {s.sub && <p className="text-xs text-gray-400 mt-1">{s.sub}</p>}
            </div>
          ))}
        </div>

        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Ore per risorsa</p>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={2}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.colore} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}h`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.colore }} />
                    <span className="text-xs text-gray-700">{d.name}</span>
                    <span className="text-xs font-semibold text-gray-900 ml-auto pl-2">{d.value}h</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-6">Nessuna allocazione</p>
          )}
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        {[
          { id: 'attivita', label: `Attività (${tasks.length})` },
          { id: 'scadenze', label: `Scadenze (${scadenze.length})` },
          { id: 'rinnovo',  label: 'Note rinnovo' },
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
                const isLast = i === tasksFiltrati.length - 1
                return (
                  <div key={t.id}
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid #F0F0F0',
                      background: t.stato === 'bloccato' ? '#FFF8F8' : isEditing ? '#F8FFFE' : 'white',
                    }}>
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: PRIO_DOT[t.priorita] }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900">{t.titolo}</span>
                        <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                          <span>{t.area}{t.milestone ? ` · ${t.milestone}` : ''}</span>
                          <span>{formatDate(t.data_inizio)} → {formatDate(t.data_fine)}</span>
                          {t.ore_stimate > 0 && <span>{t.ore_stimate}h</span>}
                          {t.ricorrente && <span style={{ color: '#185FA5' }}>↻ {t.frequenza}</span>}
                        </div>
                        {t.note && !isEditing && (
                          <p className="text-xs text-gray-400 mt-1 italic">{t.note}</p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {t.assegnatari.map(pid => {
                          const p = personaById[pid]
                          return p ? (
                            <span key={pid}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ background: p.colore }} title={p.nome}>
                              {p.nome.charAt(0)}
                            </span>
                          ) : null
                        })}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: STATI_LABEL[t.stato].bg, color: STATI_LABEL[t.stato].color }}>
                          {STATI_LABEL[t.stato].label}
                        </span>
                        <button onClick={() => setEditingTask(isEditing ? null : t.id)}
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
                    {isEditing && (
                      <TaskEditForm task={t} onSave={(changes) => saveTaskEdit(t.id, changes)} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'scadenze' && (
        <div>
          {scadenze.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Nessuna scadenza</p>
          ) : (
            <div className="space-y-3">
              {scadenze
                .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
                .map(s => {
                  const days = daysUntil(s.data)
                  return (
                    <div key={s.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4"
                      style={{
                        borderLeft: s.urgenza === 'critica' ? '4px solid #E53935' :
                          s.urgenza === 'alta' ? '4px solid #F9A825' : '4px solid transparent',
                      }}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <BadgeScadenzaTipo tipo={s.tipo} />
                        </div>
                        <p className="font-semibold text-sm text-gray-900">{s.titolo}</p>
                        {s.note && <p className="text-xs text-gray-400 mt-1 italic">{s.note}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900">{formatDate(s.data)}</p>
                        {days !== null && (
                          <p className="text-xs"
                            style={{ color: days < 0 ? '#9CA3AF' : days <= 30 ? '#C62828' : '#6B7280' }}>
                            {days < 0 ? `${Math.abs(days)}gg fa` : days === 0 ? 'Oggi' : `tra ${days}gg`}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rinnovo' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Note strategiche</p>
            <button
              onClick={() => setNotaEdit(notaEdit !== null ? null : (noteRinnovoBase?.note ?? ''))}
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
              <div className="flex gap-2 mt-3">
                <button onClick={() => setNotaEdit(null)}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
                  Salva nota
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Le modifiche sono locali — si resettano al refresh. Nella Fase 2 verranno salvate su database.</p>
            </div>
          ) : (
            <p className="text-sm text-gray-800 leading-relaxed">
              {noteRinnovoBase?.note ?? 'Nessuna nota ancora inserita per questo cliente.'}
            </p>
          )}
          {noteRinnovoBase?.anno_precedente_valore && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Storico</p>
              <p className="text-sm text-gray-800">
                Valore contratto anno precedente: <strong>€{noteRinnovoBase.anno_precedente_valore.toLocaleString('it-IT')}</strong>
              </p>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Scadenza rinnovo</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(cliente.rinnovo_previsto)}
              {giorni !== null && giorni >= 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">tra {giorni} giorni</span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskEditForm({ task, onSave }: { task: Task; onSave: (c: TaskEdit) => void }) {
  const [stato, setStato] = useState<TaskStato>(task.stato)
  const [priorita, setPriorita] = useState<TaskPriorita>(task.priorita)
  const [dataFine, setDataFine] = useState(task.data_fine)
  const [note, setNote] = useState(task.note ?? '')

  return (
    <div className="px-4 pb-4 pt-1 border-t border-dashed border-gray-200"
      style={{ background: '#F8FFFE' }}>
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Stato</label>
          <select value={stato} onChange={e => setStato(e.target.value as TaskStato)}
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
          <select value={priorita} onChange={e => setPriorita(e.target.value as TaskPriorita)}
            className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white outline-none">
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="bassa">Bassa</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Scadenza</label>
          <input type="date" value={dataFine} onChange={e => setDataFine(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white outline-none" />
        </div>
        <div className="flex items-end">
          <button onClick={() => onSave({ stato, priorita, data_fine: dataFine, note })}
            className="w-full text-sm py-1.5 rounded-lg font-medium"
            style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
            Salva
          </button>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Note</label>
        <input type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder="Aggiungi una nota..."
          className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white outline-none" />
      </div>
    </div>
  )
}