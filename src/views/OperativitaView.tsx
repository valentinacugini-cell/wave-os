import React, { useState, useMemo } from 'react'
import { Seed, Task, Persona, TaskStato, TaskPriorita } from '../types'
import { formatDate, parseDate, TODAY } from '../utils'
import { Tabs, EmptyState } from '../components/UI'

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

const PRIO_DOT: Record<TaskPriorita, string> = {
  alta: '#E24B4A', media: '#EF9F27', bassa: '#639922'
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

function ListaSettimanale({ tasks, seed, onClienteClick }: {
  tasks: Task[]
  seed: Seed
  onClienteClick: (id: string) => void
}) {
  const [filterStato, setFilterStato] = useState<'aperti' | 'tutti'>('aperti')

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

  const filtered = useMemo(() => {
    let t = tasks
    if (filterStato === 'aperti') t = t.filter(t => t.stato !== 'completato')
    return t
  }, [tasks, filterStato])

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
    return {
      label: `${fmt(d)} — ${fmt(end)}`,
      isPast: end < TODAY,
      isCurrent: d <= TODAY && TODAY <= end,
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['aperti', 'tutti'] as const).map(f => (
          <button key={f} onClick={() => setFilterStato(f)}
            className="text-sm px-3 py-1.5 rounded-lg border transition-colors capitalize"
            style={{
              background: filterStato === f ? '#1A1A2E' : 'white',
              color: filterStato === f ? '#7DF5DF' : '#666',
              borderColor: filterStato === f ? '#1A1A2E' : '#E0E0E0',
            }}>
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
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {taskList.length} task
                  </span>
                  {isCurrent && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#E1F5EE', color: '#085041' }}>
                      Settimana corrente
                    </span>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {taskList.map((t, i) => {
                    const isLast = i === taskList.length - 1
                    const nomeCliente = clienteNome[t.cliente] ?? t.cliente
                    return (
                      <div key={t.id}
                        className="flex items-start gap-3 px-4 py-3"
                        style={{
                          borderBottom: isLast ? 'none' : '1px solid #F0F0F0',
                          background: t.stato === 'bloccato' ? '#FFF8F8' : 'white',
                        }}>
                        <span className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                          style={{ background: PRIO_DOT[t.priorita] }} />
                        <div className="flex-1 min-w-0">
                          <button onClick={() => onClienteClick(t.cliente)}
                            className="text-xs font-semibold mb-0.5 hover:underline block text-left"
                            style={{ color: '#3DD4BE' }}>
                            {nomeCliente}
                          </button>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">{t.titolo}</span>
                            {t.ricorrente && (
                              <span className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: '#E6F1FB', color: '#185FA5' }}>
                                ↻ {t.frequenza}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                            <span>{t.area}</span>
                            {t.milestone && <span>· {t.milestone}</span>}
                            {t.ore_stimate > 0 && <span>· {t.ore_stimate}h</span>}
                          </div>
                          {t.note && <p className="text-xs text-gray-400 mt-1 italic">{t.note}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {t.assegnatari.map(pid => {
                            const p = personaById[pid]
                            return p ? <Avatar key={pid} persona={p} size={22} /> : null
                          })}
                        </div>
                        <div className="flex-shrink-0">
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: STATI_LABEL[t.stato].bg, color: STATI_LABEL[t.stato].color }}>
                            {STATI_LABEL[t.stato].label}
                          </span>
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

function Swimlane({ tasks, seed, onClienteClick }: {
  tasks: Task[]
  seed: Seed
  onClienteClick: (id: string) => void
}) {
  const [zoom, setZoom] = useState<'settimana' | 'mese'>('settimana')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

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

  const capacitaByPersona = useMemo(() => {
    const m: Record<string, number[]> = {}
    seed.capacita.forEach(r => { m[r.persona] = r.valori })
    return m
  }, [seed.capacita])

  function getOreAllocate(personaId: string, colStart: Date, colEnd: Date): number {
    let ore = 0
    tasks.filter(t => t.stato !== 'completato' && t.assegnatari.includes(personaId)).forEach(t => {
      const tStart = parseDate(t.data_inizio)
      const tEnd = parseDate(t.data_fine)
      if (!tStart || !tEnd || t.ore_stimate <= 0) return
      if (tStart <= colEnd && tEnd >= colStart) {
        const durataTask = Math.max(1, Math.round((tEnd.getTime() - tStart.getTime()) / (1000 * 60 * 60 * 24)))
        const overlapStart = tStart < colStart ? colStart : tStart
        const overlapEnd = tEnd > colEnd ? colEnd : tEnd
        const overlap = Math.max(1, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1)
        ore += Math.round((t.ore_stimate * overlap) / durataTask)
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

  const grid = useMemo(() => {
    type Block = { clienteId: string; area: string; count: number }
    const result: Record<string, Record<number, Block[]>> = {}
    operativi.forEach(p => {
      result[p.id] = {}
      colonne.forEach((_, ci) => { result[p.id][ci] = [] })
    })
    tasks.filter(t => t.stato !== 'completato').forEach(t => {
      const tStart = parseDate(t.data_inizio)
      const tEnd = parseDate(t.data_fine)
      if (!tStart || !tEnd) return
      t.assegnatari.forEach(pid => {
        if (!result[pid]) return
        colonne.forEach((col, ci) => {
          if (tStart <= col.end && tEnd >= col.start) {
            const existing = result[pid][ci].find(b => b.clienteId === t.cliente && b.area === t.area)
            if (existing) existing.count++
            else result[pid][ci].push({ clienteId: t.cliente, area: t.area, count: 1 })
          }
        })
      })
    })
    return result
  }, [tasks, operativi, colonne])

  const MAX_VISIBLE = 3

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['settimana', 'mese'] as const).map(z => (
          <button key={z} onClick={() => setZoom(z)}
            className="text-sm px-3 py-1.5 rounded-lg border capitalize transition-colors"
            style={{
              background: zoom === z ? '#1A1A2E' : 'white',
              color: zoom === z ? '#7DF5DF' : '#666',
              borderColor: zoom === z ? '#1A1A2E' : '#E0E0E0',
            }}>
            {z === 'settimana' ? 'Per settimana' : 'Per mese'}
          </button>
        ))}
        {zoom === 'settimana' && (
          <span className="text-xs text-gray-400 flex items-center gap-1 ml-2">
            <span className="font-semibold text-gray-600">Xh</span> allocate &nbsp;·&nbsp;
            <span className="font-semibold" style={{ color: '#1D9E75' }}>+Xh</span> libere &nbsp;/&nbsp;
            <span className="font-semibold" style={{ color: '#B91C1C' }}>−Xh</span> surplus
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-max">
          <thead>
            <tr style={{ borderBottom: '1px solid #E0E0E0', background: '#F8F9FA' }}>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50"
                style={{ minWidth: 110 }}>Risorsa</th>
              {colonne.map((col, ci) => (
                <th key={ci} className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  style={{ minWidth: 140 }}>{col.label}</th>
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
                  const isExpanded = expanded[cellKey]
                  const visible = isExpanded ? blocks : blocks.slice(0, MAX_VISIBLE)
                  const hidden = blocks.length - MAX_VISIBLE
                  const oreAllocate = zoom === 'settimana' ? getOreAllocate(p.id, col.start, col.end) : 0
                  const oreDisponibili = zoom === 'settimana' ? getOreDisponibili(p.id, col.start) : 0
                  const oreLbiere = Math.max(0, oreDisponibili - oreAllocate)
                  const isOverloaded = zoom === 'settimana' && oreAllocate > oreDisponibili

                  return (
                    <td key={ci} className="px-1.5 py-2 align-top"
                      style={{ background: isOverloaded ? '#FFF8F8' : undefined }}>
                      <div className="flex flex-col gap-1">
                        {zoom === 'settimana' && oreDisponibili > 0 && (
                          <div className="flex items-center justify-between px-1 pb-1 mb-0.5"
                            style={{ borderBottom: '1px solid #F0F0F0' }}>
                            <span className="text-xs font-semibold text-gray-600">
                              {oreAllocate}h
                            </span>
                            <span className="text-xs font-semibold"
                              style={{ color: isOverloaded ? '#B91C1C' : '#1D9E75' }}>
                              {isOverloaded ? `−${oreAllocate - oreDisponibili}h` : `+${oreLbiere}h`}
                            </span>
                          </div>
                        )}
                        {visible.map((b, bi) => (
                          <button key={`${b.clienteId}-${b.area}-${bi}`}
                            onClick={() => onClienteClick(b.clienteId)}
                            className="text-left w-full rounded px-2 py-1 text-xs leading-snug hover:opacity-75 transition-opacity"
                            style={{
                              background: p.colore + '22',
                              borderLeft: `3px solid ${p.colore}`,
                              color: '#1A1A1A',
                            }}>
                            <div className="font-semibold truncate" style={{ maxWidth: 115, fontSize: 11 }}>
                              {clienteNome[b.clienteId] ?? b.clienteId}
                            </div>
                            <div className="truncate text-gray-500" style={{ maxWidth: 115, fontSize: 10 }}>
                              {b.area}{b.count > 1 ? ` (${b.count})` : ''}
                            </div>
                          </button>
                        ))}
                        {!isExpanded && hidden > 0 && (
                          <button
                            onClick={() => setExpanded(e => ({ ...e, [cellKey]: true }))}
                            className="text-xs text-center py-0.5 rounded w-full transition-colors"
                            style={{ background: '#F1EFE8', color: '#666' }}>
                            +{hidden} altri ▾
                          </button>
                        )}
                        {isExpanded && blocks.length > MAX_VISIBLE && (
                          <button
                            onClick={() => setExpanded(e => ({ ...e, [cellKey]: false }))}
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

function VistaAnno({ seed }: { seed: Seed }) {
  const operativi = seed.team.filter(p => p.tipo === 'operativo')
  const mesi = seed.mesi_label

  const capacitaMap = useMemo(() => {
    const m: Record<string, number[]> = {}
    seed.capacita.forEach(r => { m[r.persona] = r.valori })
    return m
  }, [seed.capacita])

  const pianificateMap = useMemo(() => {
    const m: Record<string, number[]> = {}
    seed.ore_pianificate.forEach(r => { m[r.persona] = r.valori })
    return m
  }, [seed.ore_pianificate])

  const milestonePerMese = useMemo(() => {
    const m: Record<number, typeof seed.scadenze> = {}
    seed.scadenze.forEach(s => {
      const d = parseDate(s.data)
      if (!d) return
      const idx = d.getMonth() - 5
      if (idx < 0 || idx > 6) return
      if (!m[idx]) m[idx] = []
      m[idx].push(s)
    })
    return m
  }, [seed.scadenze])

  const tipoColor: Record<string, string> = {
    rinnovo: '#E07B54', rilascio: '#4F86C6',
    riunione_cliente: '#1D9E75', interno: '#888780',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full min-w-max">
        <thead>
          <tr style={{ borderBottom: '1px solid #E0E0E0', background: '#F8F9FA' }}>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50"
              style={{ minWidth: 110 }}>Risorsa</th>
            {mesi.map((m, i) => (
              <th key={i} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                style={{ minWidth: 110 }}>{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '2px solid #E0E0E0' }}>
            <td className="px-4 py-2 sticky left-0 bg-white text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Milestone
            </td>
            {mesi.map((_, mi) => {
              const items = milestonePerMese[mi] ?? []
              return (
                <td key={mi} className="px-2 py-2 align-top">
                  <div className="flex flex-col gap-0.5">
                    {items.map(s => (
                      <div key={s.id}
                        className="text-xs px-1.5 py-0.5 rounded truncate"
                        style={{
                          background: tipoColor[s.tipo] + '18',
                          color: tipoColor[s.tipo],
                          borderLeft: `2px solid ${tipoColor[s.tipo]}`,
                          maxWidth: 100,
                        }}
                        title={s.titolo}>
                        {s.titolo.length > 16 ? s.titolo.slice(0, 16) + '…' : s.titolo}
                      </div>
                    ))}
                  </div>
                </td>
              )
            })}
          </tr>
          {operativi.map(p => (
            <tr key={p.id} style={{ borderBottom: '1px solid #F0F0F0' }}>
              <td className="px-4 py-3 sticky left-0 bg-white" style={{ borderRight: '1px solid #F0F0F0' }}>
                <div className="flex items-center gap-2">
                  <Avatar persona={p} size={24} />
                  <span className="text-xs font-semibold text-gray-900">{p.nome.split(' ')[0]}</span>
                </div>
              </td>
              {mesi.map((_, mi) => {
                const cap = capacitaMap[p.id]?.[mi] ?? 0
                const plan = pianificateMap[p.id]?.[mi] ?? 0
                const isOver = plan > cap
                const pct = cap > 0 ? Math.min(Math.round((plan / cap) * 100), 100) : 0
                return (
                  <td key={mi} className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="h-4 rounded overflow-hidden" style={{ background: '#F0F0F0' }}>
                        <div className="h-full rounded"
                          style={{ width: `${pct}%`, background: isOver ? '#E24B4A' : p.colore, opacity: 0.85 }} />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs font-medium"
                          style={{ color: isOver ? '#E24B4A' : '#666' }}>{plan}h</span>
                        <span className="text-xs text-gray-400">{cap}h</span>
                      </div>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function OperativitaView({ seed, onClienteClick }: OperativitaProps) {
  const [subView, setSubView] = useState<SubView>('settimana')
  const [filtroPersona, setFiltroPersona] = useState('tutti')
  const [filtroCliente, setFiltroCliente] = useState('tutti')

  const operativi = seed.team.filter(p => p.tipo === 'operativo')

  const tasksFiltrati = useMemo(() => {
    let t = seed.tasks
    if (filtroPersona !== 'tutti') t = t.filter(task => task.assegnatari.includes(filtroPersona))
    if (filtroCliente !== 'tutti') t = t.filter(task => task.cliente === filtroCliente)
    return t
  }, [seed.tasks, filtroPersona, filtroCliente])

  const tabs = [
    { id: 'settimana', label: 'Lista settimanale' },
    { id: 'swimlane',  label: 'Swimlane' },
    { id: 'anno',      label: 'Anno intero' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Operatività</h1>
        <div className="flex gap-2">
          <select value={filtroPersona} onChange={e => setFiltroPersona(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
            <option value="tutti">Tutte le risorse</option>
            {operativi.map(p => (
              <option key={p.id} value={p.id}>{p.nome.split(' ')[0]}</option>
            ))}
          </select>
          <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
            <option value="tutti">Tutti i clienti</option>
            {seed.clienti.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <Tabs tabs={tabs as any} active={subView} onChange={id => setSubView(id as SubView)} />

      {subView === 'settimana' && (
        <ListaSettimanale tasks={tasksFiltrati} seed={seed} onClienteClick={onClienteClick} />
      )}
      {subView === 'swimlane' && (
        <Swimlane tasks={tasksFiltrati} seed={seed} onClienteClick={onClienteClick} />
      )}
      {subView === 'anno' && <VistaAnno seed={seed} />}
    </div>
  )
}