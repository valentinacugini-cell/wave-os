/**
 * MieiTaskView — Fase 2B
 * Vista "I miei task" — fonte autoritativa: assegnazioni, non tasks.assegnatari.
 * Toggle "I miei task / Tutti i task".
 */
import React, { useEffect, useState, useMemo } from 'react'
import { Seed, TaskConDati, TaskPianificazioneStato, Persona, Progetto } from '../types'
import { useTaskData } from '../context/TaskDataContext'
import { useAuth } from '../hooks/useAuth'
import TaskEditor from '../components/TaskEditor'
import { NuovoTaskInput } from '../lib/taskData'

const STATI_PIAN_LABEL: Record<TaskPianificazioneStato, { label: string; color: string; bg: string }> = {
  da_stimare:    { label: 'Da stimare',     color: '#888',    bg: '#F5F5F5' },
  da_assegnare:  { label: 'Da assegnare',   color: '#4F86C6', bg: '#EFF6FF' },
  da_pianificare:{ label: 'Da pianificare', color: '#EF9F27', bg: '#FFF3E0' },
  parziale:      { label: 'Parziale',       color: '#E07B54', bg: '#FFF0EC' },
  pianificato:   { label: 'Pianificato',    color: '#1D9E75', bg: '#E1F5EE' },
  non_assegnato: { label: 'Non assegnato',  color: '#aaa',    bg: '#F9F9F9' },
}

const PRIO_COLOR: Record<string, string> = {
  urgente: '#C62828', alta: '#E24B4A', media: '#EF9F27', bassa: '#639922'
}

function ordinaTask(tasks: TaskConDati[]): TaskConDati[] {
  const oggi = new Date().toISOString().split('T')[0]
  return [...tasks].sort((a, b) => {
    // 1. Scaduti
    const aScad = a.deadline && a.deadline < oggi
    const bScad = b.deadline && b.deadline < oggi
    if (aScad && !bScad) return -1
    if (!aScad && bScad) return 1
    // 2. Deadline imminente (entro 7gg)
    const tra7 = new Date(Date.now() + 7*86400000).toISOString().split('T')[0]
    const aImm = a.deadline && a.deadline <= tra7
    const bImm = b.deadline && b.deadline <= tra7
    if (aImm && !bImm) return -1
    if (!aImm && bImm) return 1
    // 3. Da pianificare
    const aDaPian = ['da_pianificare','parziale'].includes(a.pianificazione_stato)
    const bDaPian = ['da_pianificare','parziale'].includes(b.pianificazione_stato)
    if (aDaPian && !bDaPian) return -1
    if (!aDaPian && bDaPian) return 1
    // 4. Con deadline
    if (a.deadline && !b.deadline) return -1
    if (!a.deadline && b.deadline) return 1
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
    return 0
  })
}

export default function MieiTaskView({ seed }: { seed: Seed }) {
  const { tasks, loading, error, carica, creaTask, modificaTask, completaTaskAction, archivaTaskAction } = useTaskData()
  const { teamMember } = useAuth()

  const [mostraTutti, setMostraTutti] = useState(false)
  const [ricerca, setRicerca] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroArea, setFiltroArea] = useState('')
  const [filtroStato, setFiltroStato] = useState('')
  const [filtroPian, setFiltroPian] = useState('')
  const [filtroReview, setFiltroReview] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [taskInModifica, setTaskInModifica] = useState<TaskConDati | null>(null)

  useEffect(() => {
    carica({
      personaId: mostraTutti ? undefined : teamMember?.id,
      includiCompletati: false,
    })
  }, [mostraTutti, teamMember?.id])

  const taskFiltrati = useMemo(() => {
    let ts = tasks
    if (ricerca) ts = ts.filter(t => t.titolo.toLowerCase().includes(ricerca.toLowerCase()))
    if (filtroCliente) ts = ts.filter(t => t.cliente === filtroCliente)
    if (filtroArea) ts = ts.filter(t => t.area === filtroArea)
    if (filtroStato) ts = ts.filter(t => t.stato === filtroStato)
    if (filtroPian) ts = ts.filter(t => t.pianificazione_stato === filtroPian)
    if (filtroReview) ts = ts.filter(t => t.needs_assignment_review)
    return ordinaTask(ts)
  }, [tasks, ricerca, filtroCliente, filtroArea, filtroStato, filtroPian, filtroReview])

  const clientiPresenti = useMemo(() => {
    const ids = [...new Set(tasks.map(t => t.cliente))]
    return seed.clienti.filter(c => ids.includes(c.id))
  }, [tasks, seed.clienti])

  const areePresenti = useMemo(() => [...new Set(tasks.map(t => t.area))].sort(), [tasks])

  async function handleSave(input: NuovoTaskInput) {
    if (taskInModifica) {
      await modificaTask(taskInModifica.id, input)
    } else {
      await creaTask(input)
    }
    setShowEditor(false)
    setTaskInModifica(null)
  }

  const oggi = new Date().toISOString().split('T')[0]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {mostraTutti ? 'Tutti i task' : 'I miei task'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {loading ? 'Caricamento...' : `${taskFiltrati.length} attività`}
            {!mostraTutti && teamMember && ` · ${teamMember.nome.split(' ')[0]}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button onClick={() => setMostraTutti(false)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ background: !mostraTutti ? '#1A1A2E' : 'transparent', color: !mostraTutti ? '#7DF5DF' : '#666' }}>
              I miei task
            </button>
            <button onClick={() => setMostraTutti(true)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ background: mostraTutti ? '#1A1A2E' : 'transparent', color: mostraTutti ? '#7DF5DF' : '#666' }}>
              Tutti i task
            </button>
          </div>
          <button onClick={() => { setTaskInModifica(null); setShowEditor(true) }}
            className="text-sm px-4 py-2 rounded-xl font-medium"
            style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
            + Nuova attività
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex gap-2 flex-wrap mb-4">
        <input value={ricerca} onChange={e => setRicerca(e.target.value)}
          placeholder="Cerca..."
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-teal-400 w-48" />
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
          <option value="">Tutti i clienti</option>
          {clientiPresenti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
          <option value="">Tutte le aree</option>
          {areePresenti.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
          <option value="">Tutti gli stati</option>
          <option value="da_fare">Da fare</option>
          <option value="in_corso">In corso</option>
          <option value="completato">Completato</option>
          <option value="annullato">Annullato</option>
        </select>
        <select value={filtroPian} onChange={e => setFiltroPian(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
          <option value="">Tutta la pianificazione</option>
          <option value="da_stimare">Da stimare</option>
          <option value="da_assegnare">Da assegnare</option>
          <option value="da_pianificare">Da pianificare</option>
          <option value="parziale">Parziale</option>
          <option value="pianificato">Pianificato</option>
        </select>
        <button onClick={() => setFiltroReview(v => !v)}
          className="text-xs px-3 py-1.5 rounded-lg border transition-all"
          style={{
            borderColor: filtroReview ? '#E24B4A' : '#E5E7EB',
            background: filtroReview ? '#FEF2F2' : 'white',
            color: filtroReview ? '#E24B4A' : '#6B7280',
          }}>
          ⚠ Da revisionare
        </button>
      </div>

      {/* Lista task */}
      {error && <div className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4">{error}</div>}

      {loading && (
        <div className="text-sm text-gray-400 text-center py-12">Caricamento...</div>
      )}

      {!loading && taskFiltrati.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">
            {mostraTutti ? 'Nessun task trovato.' : 'Nessun task assegnato a te. Usa "Tutti i task" per vedere tutto.'}
          </p>
        </div>
      )}

      {!loading && taskFiltrati.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {taskFiltrati.map(task => {
            const cliente = seed.clienti.find(c => c.id === task.cliente)
            const scaduto = task.deadline && task.deadline < oggi
            const pianStato = STATI_PIAN_LABEL[task.pianificazione_stato]

            return (
              <div key={task.id}
                className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => { setTaskInModifica(task); setShowEditor(true) }}>

                {/* Priorità dot */}
                <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                  style={{ background: PRIO_COLOR[task.priorita] ?? '#ccc' }} />

                {/* Contenuto principale */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{task.titolo}</span>
                    {task.needs_assignment_review && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#FEF2F2', color: '#E24B4A' }}>Da revisionare</span>
                    )}
                    {task.blocco_tipo && task.blocco_tipo !== 'nessuno' && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#FEF2F2', color: '#E24B4A' }}>
                        🔒 {task.blocco_tipo.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400">{cliente?.nome ?? task.cliente}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{task.area}</span>
                    {task.deadline && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs font-medium" style={{ color: scaduto ? '#E24B4A' : '#888' }}>
                          {scaduto ? '⚠ ' : ''}{task.deadline}
                        </span>
                      </>
                    )}
                    {task.prossima_data_pianificata && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-teal-600">→ {task.prossima_data_pianificata}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Indicatori ore */}
                <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0">
                  {task.ore_stimate !== null ? (
                    <>
                      <span title="Stimate">{task.ore_stimate}h</span>
                      <span title="Assegnate" style={{ color: '#4F86C6' }}>{task.ore_assegnate_totali}h asgn</span>
                      {task.ore_pianificate_totali > 0 && (
                        <span title="Pianificate" style={{ color: '#1D9E75' }}>{task.ore_pianificate_totali}h pian</span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-300">— h</span>
                  )}
                </div>

                {/* Badge assegnatari */}
                <div className="flex -space-x-1 flex-shrink-0">
                  {task.assegnazioni.slice(0,3).map(a => {
                    const p = seed.team.find(x => x.id === a.persona_id)
                    return (
                      <div key={a.id} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: p?.colore ?? '#888' }} title={p?.nome}>
                        {p?.nome.charAt(0) ?? '?'}
                      </div>
                    )
                  })}
                </div>

                {/* Badge pianificazione */}
                <span className="text-xs px-2 py-0.5 rounded-lg flex-shrink-0"
                  style={{ background: pianStato.bg, color: pianStato.color }}>
                  {pianStato.label}
                </span>

                {/* Azioni rapide */}
                <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {task.stato !== 'completato' && (
                    <button
                      onClick={e => { e.stopPropagation(); completaTaskAction(task.id, false) }}
                      title="Completa"
                      className="w-7 h-7 rounded-lg border border-gray-200 text-xs text-gray-400 hover:text-green-600 hover:border-green-300 flex items-center justify-center">
                      ✓
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); archivaTaskAction(task.id) }}
                    title="Archivia"
                    className="w-7 h-7 rounded-lg border border-gray-200 text-xs text-gray-400 hover:text-red-400 hover:border-red-200 flex items-center justify-center">
                    ⊘
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Editor */}
      {showEditor && (
        <TaskEditor
          team={seed.team}
          clienti={seed.clienti.map(c => ({ id: c.id, nome: c.nome }))}
          progetti={seed.progetti}
          scadenze={seed.scadenze}
          taskEsistente={taskInModifica}
          onSave={handleSave}
          onClose={() => { setShowEditor(false); setTaskInModifica(null) }}
          onCompleta={taskInModifica ? (libera) => completaTaskAction(taskInModifica.id, libera) : undefined}
          onArchivia={taskInModifica ? () => archivaTaskAction(taskInModifica.id).then(() => { setShowEditor(false); setTaskInModifica(null) }) : undefined}
        />
      )}
    </div>
  )
}
