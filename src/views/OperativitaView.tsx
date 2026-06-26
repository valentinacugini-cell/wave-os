import React, { useState, useMemo } from 'react'
import { Seed, Task, Persona, TaskStato, TaskPriorita, Progetto } from '../types'
import { formatDate, parseDate, TODAY } from '../utils'
import { Tabs, EmptyState } from '../components/UI'
import TaskModal from '../components/TaskModal'
import { useTaskContext } from '../context/TaskContext'

interface OperativitaProps {
  seed: Seed
  onClienteClick: (id: string) => void
}

type SubView = 'settimana' | 'swimlane' | 'anno'

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

function Avatar({ persona, size = 24 }: { persona: Persona; size?: number }) {
  return (
    <span className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, background: persona.colore }}
      title={persona.nome}>
      {persona.nome.charAt(0)}
    </span>
  )
}

function weekOf(d: Date): string {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d)
  mon.setDate(diff)
  return mon.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// ── Lista settimanale ──────────────────────────────────────────────────────

function ListaSettimanale({ tasks, seed, onOpenTask }: {
  tasks: Task[]
  seed: Seed
  onOpenTask: (task: Task) => void
}) {
  const [filterStato, setFilterStato] = useState<'aperti' | 'tutti'>('aperti')
  const [expanded, setExpanded] = useState<string | null>(null)
  const { getTask } = useTaskContext()

  const personaById = useMemo(() => {
    const m: Record<string, Persona> = {}
    seed.team.forEach(p => { m[p.id] = p })
    return m
  }, [seed.team])

  const clienteNome = useMemo(() => {
    const m: Record<string, string> = {}
    seed.clienti.forEach(c => { m[c.id] = c.nome })
    return m
  }, [seed.clienti])

  const progettoNome = useMemo(() => {
    const m: Record<string, string> = {}
    ;(seed.progetti ?? []).forEach(p => { m[p.id] = p.nome })
    return m
  }, [seed.progetti])

  const filtered = useMemo(() => {
    let t = tasks.map(t => getTask(t))
    if (filterStato === 'aperti') t = t.filter(t => t.stato !== 'completato')
    return t
  }, [tasks, filterStato, getTask])

  const grouped = useMemo(() => {
    const groups: Record<string, Task[]> = {}
    filtered.forEach(t => {
      const d = parseDate(t.data_fine)
      if (!d) return
      const w = weekOf(d)
      if (!groups[w]) groups[w] = []
      groups[w].push(t)
    })
    Object.values(groups).forEach(list =>
      list.sort((a, b) => {
        const po: Record<TaskPriorita, number> = { alta: 0, media: 1, bassa: 2 }
        return po[a.priorita] - po[b.priorita]
      })
    )
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const weekLabel = (iso: string) => {
    const d = new Date(iso)
    const end = addDays(d, 6)
    const fmt = (x: Date) => x.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    return { label: `${fmt(d)} — ${fmt(end)}`, isPast: end < TODAY, isCurrent: d <= TODAY && TODAY <= end }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['aperti', 'tutti'] as const).map(f => (
          <button key={f} onClick={() => setFilterStato(f)}
            className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
            style={{ background: filterStato === f ? '#1A1A2E' : 'white', color: filterStato === f ? '#7DF5DF' : '#666', borderColor: filterStato === f ? '#1A1A2E' : '#E0E0E0' }}>
            {f === 'aperti' ? 'Aperti' : 'Tutti'}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? <EmptyState message="Nessun task" /> : (
        <div className="space-y-6">
          {grouped.map(([weekStart, taskList]) => {
            const { label, isPast, isCurrent } = weekLabel(weekStart)
            return (
              <div key={weekStart}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-sm font-semibold"
                    style={{ color: isCurrent ? '#1D9E75' : isPast ? '#9CA3AF' : '#333' }}>
                    {isCurrent && '▶ '}{label}
                  </h3>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{taskList.length} task</span>
                  {isCurrent && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#E1F5EE', color: '#085041' }}>Settimana corrente</span>}
                </div>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {taskList.map((t, i) => {
                    const isLast = i === taskList.length - 1
                    const isExp = expanded === t.id
                    return (
                      <div key={t.id} style={{ borderBottom: isLast ? 'none' : '1px solid #F0F0F0', background: t.stato === 'bloccato' ? '#FFF8F8' : 'white' }}>
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PRIO[t.priorita].dot }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <button onClick={() => setExpanded(isExp ? null : t.id)} className="text-xs font-semibold hover:underline" style={{ color: '#3DD4BE' }}>
                                {clienteNome[t.cliente] ?? t.cliente}
                              </button>
                              {t.progetto_id && progettoNome[t.progetto_id] && (
                                <span className="text-xs text-gray-400 truncate" style={{ maxWidth: 180 }}>
                                  · {progettoNome[t.progetto_id]}
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-900">{t.titolo}</span>
                            {isExp && (
                              <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                                <span>{t.area}</span>
                                {t.milestone && <span>· {t.milestone}</span>}
                                <span>{formatDate(t.data_inizio)} → {formatDate(t.data_fine)}</span>
                                {t.ore_stimate > 0 && <span>{t.ore_stimate}h</span>}
                                {t.ricorrente && <span style={{ color: '#185FA5' }}>↻ {t.frequenza}</span>}
                                {t.note && <span className="italic">{t.note}</span>}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-0.5 flex-shrink-0">
                            {t.assegnatari.map(pid => {
                              const p = personaById[pid]
                              return p ? <Avatar key={pid} persona={p} size={22} /> : null
                            })}
                          </div>
                          <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: PRIO[t.priorita].bg, color: PRIO[t.priorita].color }}>
                            {PRIO[t.priorita].label}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: STATI_LABEL[t.stato].bg, color: STATI_LABEL[t.stato].color }}>
                            {STATI_LABEL[t.stato].label}
                          </span>
                          <button onClick={() => setExpanded(isExp ? null : t.id)}
                            className="text-xs px-1.5 py-0.5 rounded border transition-colors flex-shrink-0"
                            style={{ borderColor: '#E0E0E0', color: '#999', background: 'white' }}>
                            {isExp ? '▴' : '▾'}
                          </button>
                          <button onClick={() => onOpenTask(tasks.find(raw => raw.id === t.id) ?? t)}
                            className="text-xs px-2 py-0.5 rounded border transition-colors flex-shrink-0"
                            style={{ borderColor: '#E0E0E0', color: '#999', background: 'white' }}>
                            Modifica
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Swimlane ───────────────────────────────────────────────────────────────

function TaskHoverCard({ tasks, personaById, onSelect }: {
  tasks: Task[]
  personaById: Record<string, Persona>
  onSelect: (t: Task) => void
}) {
  const PRIO_DOT: Record<TaskPriorita, string> = { alta: '#E24B4A', media: '#EF9F27', bassa: '#639922' }
  const STATI_SHORT: Record<TaskStato, string> = {
    da_fare: 'Da fare', in_corso: 'In corso', completato: 'Fatto',
    bloccato: 'Bloccato', in_attesa_materiali: 'Attesa'
  }
  return (
    <div className="absolute z-40 bg-white rounded-xl shadow-2xl border border-gray-100 p-3 min-w-52 max-w-72"
      style={{ top: '100%', left: 0, marginTop: 6 }}
      onMouseDown={e => e.preventDefault()}>
      {tasks.map(t => (
        <button key={t.id}
          onClick={e => { e.stopPropagation(); onSelect(t) }}
          className="w-full text-left p-2.5 rounded-lg hover:bg-gray-50 transition-colors mb-1 last:mb-0"
          style={{ border: '1px solid #F0F0F0' }}>
          <div className="flex items-start gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: PRIO_DOT[t.priorita] }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 leading-snug">{t.titolo}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-gray-400">{STATI_SHORT[t.stato]}</span>
                {t.ore_stimate > 0 && <span className="text-xs text-gray-400">{t.ore_stimate}h</span>}
                {t.data_fine && <span className="text-xs text-gray-400">scad. {new Date(t.data_fine).toLocaleDateString('it-IT', {day:'numeric', month:'short'})}</span>}
                <div className="flex gap-0.5 ml-auto">
                  {t.assegnatari.slice(0, 2).map(pid => {
                    const p = personaById[pid]
                    return p ? (
                      <span key={pid} className="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ background: p.colore, fontSize: 8 }}>{p.nome.charAt(0)}</span>
                    ) : null
                  })}
                </div>
              </div>
              {t.note && <p className="text-xs text-gray-400 mt-1 italic truncate">{t.note}</p>}
            </div>
          </div>
        </button>
      ))}
      <p className="text-xs text-gray-400 text-center mt-2 pt-2" style={{ borderTop: '1px solid #F0F0F0' }}>
        Clicca un task per modificarlo
      </p>
    </div>
  )
}

function Swimlane({ tasks, seed, onOpenTask }: {
  tasks: Task[]
  seed: Seed
  onOpenTask: (task: Task) => void
}) {
  const [zoom, setZoom] = useState<'settimana' | 'mese'>('settimana')
  const [expandedCell, setExpandedCell] = useState<string | null>(null)
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const { getTask } = useTaskContext()

  const operativi = seed.team.filter(p => p.tipo === 'operativo')

  const personaById = useMemo(() => {
    const m: Record<string, Persona> = {}
    seed.team.forEach(p => { m[p.id] = p })
    return m
  }, [seed.team])

  const clienteNome = useMemo(() => {
    const m: Record<string, string> = {}
    seed.clienti.forEach(c => { m[c.id] = c.nome })
    return m
  }, [seed.clienti])

  const progettoNome = useMemo(() => {
    const m: Record<string, string> = {}
    ;(seed.progetti ?? []).forEach(p => { m[p.id] = p.nome })
    return m
  }, [seed.progetti])

  const capacitaByPersona = useMemo(() => {
    const m: Record<string, number[]> = {}
    seed.capacita.forEach(r => { m[r.persona] = r.valori })
    return m
  }, [seed.capacita])

  function getOreAllocate(personaId: string, colStart: Date, colEnd: Date): number {
    let ore = 0
    tasks.filter(t => t.stato !== 'completato' && t.assegnatari.includes(personaId)).forEach(t => {
      const rt = getTask(t)
      const tStart = parseDate(rt.data_inizio)
      const tEnd = parseDate(rt.data_fine)
      if (!tStart || !tEnd || rt.ore_stimate <= 0) return
      if (tStart <= colEnd && tEnd >= colStart) {
        const durataTask = Math.max(1, Math.round((tEnd.getTime() - tStart.getTime()) / (1000 * 60 * 60 * 24)))
        const overlapStart = tStart < colStart ? colStart : tStart
        const overlapEnd = tEnd > colEnd ? colEnd : tEnd
        const overlap = Math.max(1, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1)
        ore += Math.round((rt.ore_stimate * overlap) / durataTask)
      }
    })
    return ore
  }

  function getOreDisponibili(personaId: string, colStart: Date): number {
    const meseIdx = colStart.getMonth() - 5
    if (meseIdx < 0 || meseIdx > 6) return 0
    const cap = capacitaByPersona[personaId]?.[meseIdx] ?? 0
    return Math.round(cap / 4.3)
  }

  const colonne = useMemo(() => {
    if (zoom === 'mese') {
      return ['Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'].map((label, i) => ({
        label, start: new Date(2026, 5 + i, 1), end: new Date(2026, 6 + i, 0),
      }))
    }
    const cols = []
    const startWeek = new Date(weekOf(TODAY))
    for (let i = 0; i < 8; i++) {
      const s = addDays(startWeek, i * 7)
      const e = addDays(s, 6)
      cols.push({ label: s.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }), start: s, end: e })
    }
    return cols
  }, [zoom])

  // Aggrega per cliente+area con lista task associati
  const grid = useMemo(() => {
    type Block = { clienteId: string; area: string; progettoId: string | null; priorita: TaskPriorita; tasks: Task[] }
    const result: Record<string, Record<number, Block[]>> = {}
    operativi.forEach(p => {
      result[p.id] = {}
      colonne.forEach((_, ci) => { result[p.id][ci] = [] })
    })
    tasks.filter(t => t.stato !== 'completato').forEach(rawT => {
      const t = getTask(rawT)
      const tStart = parseDate(t.data_inizio)
      const tEnd = parseDate(t.data_fine)
      if (!tStart || !tEnd) return
      t.assegnatari.forEach(pid => {
        if (!result[pid]) return
        colonne.forEach((col, ci) => {
          if (tStart <= col.end && tEnd >= col.start) {
            const existing = result[pid][ci].find(b => b.clienteId === t.cliente && b.area === t.area)
            if (existing) {
              existing.tasks.push(rawT)
              // Scala priorità al massimo
              const po: Record<TaskPriorita, number> = { alta: 0, media: 1, bassa: 2 }
              if (po[t.priorita] < po[existing.priorita]) existing.priorita = t.priorita
            } else {
              result[pid][ci].push({ clienteId: t.cliente, area: t.area, progettoId: t.progetto_id ?? null, priorita: t.priorita, tasks: [rawT] })
            }
          }
        })
      })
    })
    return result
  }, [tasks, operativi, colonne, getTask])

  const MAX_VISIBLE = 3

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center">
        {(['settimana', 'mese'] as const).map(z => (
          <button key={z} onClick={() => setZoom(z)}
            className="text-sm px-3 py-1.5 rounded-lg border capitalize transition-colors"
            style={{ background: zoom === z ? '#1A1A2E' : 'white', color: zoom === z ? '#7DF5DF' : '#666', borderColor: zoom === z ? '#1A1A2E' : '#E0E0E0' }}>
            {z === 'settimana' ? 'Per settimana' : 'Per mese'}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-2 flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#E24B4A' }}/>Alta</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#EF9F27' }}/>Media</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#639922' }}/>Bassa</span>
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-max">
          <thead>
            <tr style={{ borderBottom: '1px solid #E0E0E0', background: '#F8F9FA' }}>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50" style={{ minWidth: 110 }}>Risorsa</th>
              {colonne.map((col, ci) => (
                <th key={ci} className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ minWidth: 140 }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {operativi.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                <td className="px-4 py-3 sticky left-0 bg-white" style={{ borderRight: '1px solid #F0F0F0' }}>
                  <div className="flex items-center gap-2">
                    <Avatar persona={p} size={26} />
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{p.nome.split(' ')[0]}</p>
                      <p className="text-xs text-gray-400">{p.ruolo.split(' ')[0]}</p>
                    </div>
                  </div>
                </td>
                {colonne.map((col, ci) => {
                  const blocks = grid[p.id]?.[ci] ?? []
                  const cellKey = `${p.id}-${ci}`
                  const isExp = expandedCell === cellKey
                  const visible = isExp ? blocks : blocks.slice(0, MAX_VISIBLE)
                  const hidden = blocks.length - MAX_VISIBLE
                  const oreAllocate = zoom === 'settimana' ? getOreAllocate(p.id, col.start, col.end) : 0
                  const oreDisp = zoom === 'settimana' ? getOreDisponibili(p.id, col.start) : 0
                  const isOverloaded = zoom === 'settimana' && oreAllocate > oreDisp

                  return (
                    <td key={ci} className="px-1.5 py-2 align-top" style={{ background: isOverloaded ? '#FFF8F8' : undefined }}>
                      <div className="flex flex-col gap-1">
                        {zoom === 'settimana' && oreDisp > 0 && (
                          <div className="flex items-center justify-between px-1 pb-1 mb-0.5" style={{ borderBottom: '1px solid #F0F0F0' }}>
                            <span className="text-xs font-semibold text-gray-600">{oreAllocate}h</span>
                            <span className="text-xs font-semibold" style={{ color: isOverloaded ? '#B91C1C' : '#1D9E75' }}>
                              {isOverloaded ? `-${oreAllocate - oreDisp}h` : `+${oreDisp - oreAllocate}h`}
                            </span>
                          </div>
                        )}
                        {visible.map((b, bi) => {
                          const prioColor = PRIO[b.priorita].dot
                          const blockKey = `${p.id}-${ci}-${bi}`
                          const showTooltip = activeTooltip === blockKey
                          return (
                            <div key={`${b.clienteId}-${b.area}-${bi}`} className="relative"
                              onMouseEnter={() => setActiveTooltip(blockKey)}
                              onMouseLeave={() => setActiveTooltip(null)}>
                              <button
                                onClick={() => b.tasks.length === 1 ? onOpenTask(b.tasks[0]) : undefined}
                                className="text-left w-full rounded px-2 py-1 text-xs leading-snug hover:opacity-90 transition-opacity"
                                style={{ background: prioColor + '18', borderLeft: `3px solid ${prioColor}`, color: '#1A1A1A' }}>
                                <div className="font-semibold truncate" style={{ maxWidth: 115, fontSize: 11 }}>
                                  {clienteNome[b.clienteId] ?? b.clienteId}
                                </div>
                                <div className="truncate text-gray-400" style={{ maxWidth: 115, fontSize: 10 }}>
                                  {b.progettoId ? (progettoNome[b.progettoId] ?? b.area) : b.area}
                                  {b.tasks.length > 1 ? ` (${b.tasks.length})` : ''}
                                </div>
                              </button>
                              {showTooltip && (
                                <TaskHoverCard
                                  tasks={b.tasks}
                                  personaById={personaById}
                                  onSelect={onOpenTask}
                                />
                              )}
                            </div>
                          )
                        })}
                        {!isExp && hidden > 0 && (
                          <button onClick={() => setExpandedCell(cellKey)}
                            className="text-xs text-center py-0.5 rounded w-full"
                            style={{ background: '#F1EFE8', color: '#666' }}>
                            +{hidden} altri ▾
                          </button>
                        )}
                        {isExp && blocks.length > MAX_VISIBLE && (
                          <button onClick={() => setExpandedCell(null)}
                            className="text-xs text-center py-0.5 rounded w-full"
                            style={{ background: '#F1EFE8', color: '#666' }}>
                            Mostra meno ▴
                          </button>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Vista Anno ─────────────────────────────────────────────────────────────

function VistaAnno({ seed }: { seed: Seed }) {
  const [annoSelezionato, setAnnoSelezionato] = useState(TODAY.getFullYear())
  const [filterTipo, setFilterTipo] = useState<'tutte' | 'rinnovo' | 'rilascio' | 'riunione_cliente'>('tutte')

  const oggi = TODAY
  const annoMin = oggi.getFullYear()
  const annoMax = oggi.getFullYear() + 5

  const operativi = seed.team.filter(p => p.tipo === 'operativo')

  const personaById = useMemo(() => {
    const m: Record<string, Persona> = {}
    seed.team.forEach(p => { m[p.id] = p })
    return m
  }, [seed.team])

  const progettoById = useMemo(() => {
    const m: Record<string, string> = {}
    ;(seed.progetti ?? []).forEach(p => { m[p.id] = p.nome })
    return m
  }, [seed.progetti])

  // 12 mesi dell'anno selezionato
  const mesi = useMemo(() => {
    const labels = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
    return labels.map((label, i) => ({
      label,
      start: new Date(annoSelezionato, i, 1),
      end: new Date(annoSelezionato, i + 1, 0),
      index: i,
    }))
  }, [annoSelezionato])

  const rangeStart = mesi[0].start
  const rangeEnd = mesi[11].end
  const totalDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24))

  function pct(date: Date): number {
    const days = Math.round((date.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, Math.min(100, (days / totalDays) * 100))
  }

  const oggiPct = annoSelezionato === oggi.getFullYear() ? pct(oggi) : -1

  // Scadenze filtrate
  const scadenzeAnno = useMemo(() => {
    let s = seed.scadenze.filter(s => {
      const d = new Date(s.data)
      return d.getFullYear() === annoSelezionato && s.stato === 'aperto'
    })
    if (filterTipo !== 'tutte') s = s.filter(s => s.tipo === filterTipo)
    return s
  }, [seed.scadenze, annoSelezionato, filterTipo])

  const scadenzePerCliente = useMemo(() => {
    const m: Record<string, typeof scadenzeAnno> = {}
    scadenzeAnno.forEach(s => {
      if (s.cliente) {
        if (!m[s.cliente]) m[s.cliente] = []
        m[s.cliente].push(s)
      }
    })
    return m
  }, [scadenzeAnno])

  // Clienti attivi nell'anno
  const clientiAnno = seed.clienti.filter(c => {
    if (c.stato === 'concluso') return false
    const scad = c.scadenza_contratto ? new Date(c.scadenza_contratto) : null
    if (scad && scad.getFullYear() >= annoSelezionato) return true
    if (!scad && c.stato === 'attivo') return true
    return (scadenzePerCliente[c.id] ?? []).length > 0
  })

  // Carico operativi per mese (indice = mese 0-11)
  const capacitaByPersona = useMemo(() => {
    const m: Record<string, number[]> = {}
    seed.capacita.forEach(r => { m[r.persona] = r.valori })
    return m
  }, [seed.capacita])

  const pianificateByPersona = useMemo(() => {
    const m: Record<string, number[]> = {}
    seed.ore_pianificate.forEach(r => { m[r.persona] = r.valori })
    return m
  }, [seed.ore_pianificate])

  const TIPO_COLOR: Record<string, string> = {
    rinnovo: '#E07B54', rilascio: '#4F86C6',
    riunione_cliente: '#1D9E75', interno: '#888780', checkpoint: '#A67DC6',
  }

  // Offset mesi per anno selezionato (seed ha giu-dic = indici 0-6)
  // Per anno 2026: gen=N/A, feb=N/A ... giu=0, lug=1 ...
  // Per anni futuri: tutti N/A (no data)
  function getMeseIdx(meseAnno: number): number {
    if (annoSelezionato === 2026) return meseAnno - 5 // giu=5→0, dic=11→6
    return -1 // nessun dato per anni diversi
  }

  const tipoTabs = [
    { id: 'tutte', label: 'Tutte' },
    { id: 'rinnovo', label: 'Rinnovi' },
    { id: 'rilascio', label: 'Rilasci' },
    { id: 'riunione_cliente', label: 'Riunioni' },
  ]

  const COL_WIDTH = 180

  return (
    <div>
      {/* Header anno + filtri */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setAnnoSelezionato(a => Math.max(a - 1, annoMin))}
            disabled={annoSelezionato <= annoMin}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors">
            ‹
          </button>
          <div className="text-center min-w-20">
            <p className="text-lg font-bold text-gray-900">{annoSelezionato}</p>
            <p className="text-xs text-gray-400">{clientiAnno.length} clienti</p>
          </div>
          <button onClick={() => setAnnoSelezionato(a => Math.min(a + 1, annoMax))}
            disabled={annoSelezionato >= annoMax}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors">
            ›
          </button>
        </div>
        <div className="flex gap-1">
          {tipoTabs.map(t => (
            <button key={t.id} onClick={() => setFilterTipo(t.id as any)}
              className="text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium"
              style={{
                background: filterTipo === t.id ? '#1A1A2E' : 'white',
                color: filterTipo === t.id ? '#7DF5DF' : '#666',
                borderColor: filterTipo === t.id ? '#1A1A2E' : '#E0E0E0',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* SEZIONE 1 — Clienti Gantt */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        {/* Label sezione */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2"
          style={{ background: '#F8F9FA' }}>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Clienti e scadenze</span>
          <div className="ml-auto flex items-center gap-3">
            {[['rinnovo','Rinnovo'],['rilascio','Rilascio'],['riunione_cliente','Riunione']].map(([tipo, label]) => (
              <span key={tipo} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full" style={{ background: TIPO_COLOR[tipo] }} />
                {label}
              </span>
            ))}
            {oggiPct >= 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 border-t-2 border-dashed inline-block" style={{ borderColor: '#1D9E75' }} />
                Oggi
              </span>
            )}
          </div>
        </div>

        {/* Header mesi */}
        <div className="flex border-b border-gray-100" style={{ paddingLeft: COL_WIDTH }}>
          {mesi.map((m, i) => (
            <div key={i} className="flex-1 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide py-2"
              style={{ borderLeft: i > 0 ? '1px solid #F0F0F0' : 'none' }}>
              {m.label}
            </div>
          ))}
        </div>

        {/* Righe clienti */}
        {clientiAnno.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">Nessun cliente nel {annoSelezionato}</div>
        ) : clientiAnno.map((cliente, ci) => {
          const referente = personaById[cliente.referente]
          const scadenze = scadenzePerCliente[cliente.id] ?? []
          const contrEnd = cliente.scadenza_contratto ? new Date(cliente.scadenza_contratto) : rangeEnd
          const barRight = pct(contrEnd)
          const barColor = referente?.colore ?? '#7DF5DF'

          return (
            <div key={cliente.id}
              className="flex items-center border-b border-gray-100 last:border-0"
              style={{ minHeight: 40, background: ci % 2 === 0 ? 'white' : '#FAFAFA' }}>
              <div className="flex items-center gap-2 px-3 flex-shrink-0"
                style={{ width: COL_WIDTH, borderRight: '1px solid #F0F0F0' }}>
                {referente && (
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ background: referente.colore, fontSize: 8 }}>
                    {referente.nome.charAt(0)}
                  </span>
                )}
                <span className="text-xs font-medium text-gray-900 truncate">{cliente.nome}</span>
              </div>
              <div className="flex-1 relative" style={{ height: 40 }}>
                {mesi.map((_, i) => i > 0 && (
                  <div key={i} className="absolute top-0 bottom-0"
                    style={{ left: `${(i / 12) * 100}%`, borderLeft: '1px solid #F0F0F0' }} />
                ))}
                {oggiPct >= 0 && (
                  <div className="absolute top-0 bottom-0 z-10"
                    style={{ left: `${oggiPct}%`, borderLeft: '2px dashed #1D9E75', opacity: 0.4 }} />
                )}
                <div className="absolute rounded"
                  style={{ left: 0, width: `${Math.min(barRight, 100)}%`, top: '50%', transform: 'translateY(-50%)', height: 12, background: barColor + '20', border: `1.5px solid ${barColor}40` }} />
                {scadenze.map(s => {
                  const d = new Date(s.data)
                  if (d < rangeStart || d > rangeEnd) return null
                  const left = pct(d)
                  const color = TIPO_COLOR[s.tipo] ?? '#888780'
                  return (
                    <div key={s.id} className="absolute z-20 group cursor-pointer"
                      style={{ left: `${left}%`, top: '50%', transform: 'translate(-50%, -50%)' }}>
                      <div className="w-2.5 h-2.5 rotate-45 group-hover:scale-125 transition-transform"
                        style={{ background: color, border: '1px solid white', boxShadow: `0 0 0 1px ${color}` }} />
                      <div className="absolute z-30 bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                        style={{ bottom: '140%', left: '50%', transform: 'translateX(-50%)' }}>
                        <p className="font-semibold">{s.titolo}</p>
                        {s.progetto_id && progettoById[s.progetto_id] && (
                          <p className="text-white/60 text-xs">{progettoById[s.progetto_id]}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* SEZIONE 2 — Carico operativi */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100" style={{ background: '#F8F9FA' }}>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Carico risorse</span>
        </div>

        {/* Header mesi */}
        <div className="flex border-b border-gray-100" style={{ paddingLeft: COL_WIDTH }}>
          {mesi.map((m, i) => (
            <div key={i} className="flex-1 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide py-2"
              style={{ borderLeft: i > 0 ? '1px solid #F0F0F0' : 'none' }}>
              {m.label}
            </div>
          ))}
        </div>

        {operativi.map(p => (
          <div key={p.id} className="flex items-center border-b border-gray-100 last:border-0"
            style={{ minHeight: 48 }}>
            <div className="flex items-center gap-2 px-3 flex-shrink-0"
              style={{ width: COL_WIDTH, borderRight: '1px solid #F0F0F0' }}>
              <Avatar persona={p} size={22} />
              <span className="text-xs font-semibold text-gray-900">{p.nome.split(' ')[0]}</span>
            </div>
            <div className="flex-1 flex">
              {mesi.map((m, i) => {
                const seedIdx = getMeseIdx(m.index)
                const cap = seedIdx >= 0 ? (capacitaByPersona[p.id]?.[seedIdx] ?? 0) : 0
                const plan = seedIdx >= 0 ? (pianificateByPersona[p.id]?.[seedIdx] ?? 0) : 0
                const isOver = plan > cap && cap > 0
                const pct2 = cap > 0 ? Math.min(Math.round((plan / cap) * 100), 100) : 0

                return (
                  <div key={i} className="flex-1 px-1.5 py-2"
                    style={{ borderLeft: i > 0 ? '1px solid #F0F0F0' : 'none', background: isOver ? '#FFF8F8' : undefined }}>
                    {cap > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="h-3 rounded overflow-hidden" style={{ background: '#F0F0F0' }}>
                          <div className="h-full rounded"
                            style={{ width: `${pct2}%`, background: isOver ? '#E24B4A' : p.colore, opacity: 0.85 }} />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs font-medium"
                            style={{ color: isOver ? '#E24B4A' : '#666', fontSize: 9 }}>{plan}h</span>
                          <span className="text-xs text-gray-400" style={{ fontSize: 9 }}>{cap}h</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-3 rounded" style={{ background: '#F5F5F5' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function OperativitaView({ seed, onClienteClick }: OperativitaProps) {
  const [subView, setSubView] = useState<SubView>('settimana')
  const [filtroPersona, setFiltroPersona] = useState('tutti')
  const [filtroCliente, setFiltroCliente] = useState('tutti')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const { updateTask, getTask } = useTaskContext()

  const operativi = seed.team.filter(p => p.tipo === 'operativo')

  const personaById = useMemo(() => {
    const m: Record<string, Persona> = {}
    seed.team.forEach(p => { m[p.id] = p })
    return m
  }, [seed.team])

  const clienteNome = useMemo(() => {
    const m: Record<string, string> = {}
    seed.clienti.forEach(c => { m[c.id] = c.nome })
    return m
  }, [seed.clienti])

  // Progetti per cliente attivo nel modal
  const progettiPerCliente = useMemo(() => {
    const m: Record<string, Progetto[]> = {}
    ;(seed.progetti ?? []).forEach(p => {
      if (!m[p.cliente]) m[p.cliente] = []
      m[p.cliente].push(p)
    })
    return m
  }, [seed.progetti])

  const tasksFiltrati = useMemo(() => {
    let t = seed.tasks
    if (filtroPersona !== 'tutti') t = t.filter(task => task.assegnatari.includes(filtroPersona))
    if (filtroCliente !== 'tutti') t = t.filter(task => task.cliente === filtroCliente)
    return t
  }, [seed.tasks, filtroPersona, filtroCliente])

  const tabs = [
    { id: 'settimana', label: 'Lista settimanale' },
    { id: 'swimlane', label: 'Swimlane' },
    { id: 'anno', label: 'Anno intero' },
  ]

  return (
    <div>
      {activeTask && (
        <TaskModal
          task={getTask(activeTask)}
          personaById={personaById}
          clienteNome={clienteNome[activeTask.cliente] ?? activeTask.cliente}
          progetti={progettiPerCliente[activeTask.cliente] ?? []}
          onClose={() => setActiveTask(null)}
          onSave={(id, updates) => updateTask(id, updates)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Operatività</h1>
        <div className="flex gap-2">
          <select value={filtroPersona} onChange={e => setFiltroPersona(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
            <option value="tutti">Tutte le risorse</option>
            {operativi.map(p => <option key={p.id} value={p.id}>{p.nome.split(' ')[0]}</option>)}
          </select>
          <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
            <option value="tutti">Tutti i clienti</option>
            {seed.clienti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      <Tabs tabs={tabs as any} active={subView} onChange={id => setSubView(id as SubView)} />

      {subView === 'settimana' && <ListaSettimanale tasks={tasksFiltrati} seed={seed} onOpenTask={setActiveTask} />}
      {subView === 'swimlane' && <Swimlane tasks={tasksFiltrati} seed={seed} onOpenTask={setActiveTask} />}
      {subView === 'anno' && <VistaAnno seed={seed} />}
    </div>
  )
}
