import React, { useState, useMemo } from 'react'
import { Seed, Persona, Scadenza, ScadenzaTipo } from '../types'
import { daysUntil, formatDate, TODAY } from '../utils'
import { BadgeScadenzaTipo, StatCard, SectionHeader, Tabs, EmptyState } from '../components/UI'

interface ScadenzeProps {
  seed: Seed
  onClienteClick?: (id: string) => void
}

type FilterTipo = 'tutte' | ScadenzaTipo
type MainView = 'lista' | 'calendario'

const TIPO_COLOR: Record<string, string> = {
  rinnovo: '#E07B54',
  rilascio: '#4F86C6',
  riunione_cliente: '#1D9E75',
  interno: '#888780',
  checkpoint: '#A67DC6',
}

// ── Calendario Gantt ──────────────────────────────────────────────────────

function CalendarioView({ seed, onClienteClick }: { seed: Seed; onClienteClick?: (id: string) => void }) {
  const [filterTipo, setFilterTipo] = useState<FilterTipo>('tutte')
  const [hoveredCliente, setHoveredCliente] = useState<string | null>(null)
  const [annoSelezionato, setAnnoSelezionato] = useState(TODAY.getFullYear())

  const oggi = TODAY

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

  // Anno minimo = anno corrente, anno massimo = anno più lontano nei dati
  const annoMin = oggi.getFullYear()
  const annoMax = oggi.getFullYear() + 5 // Navigazione libera fino a 5 anni avanti

  // 12 mesi dell'anno selezionato
  const mesi = useMemo(() => {
    const mesiLabel = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
    return mesiLabel.map((label, i) => ({
      label,
      start: new Date(annoSelezionato, i, 1),
      end: new Date(annoSelezionato, i + 1, 0),
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

  const scadenzeFiltered = useMemo(() => {
    let s = seed.scadenze.filter(s => s.stato === 'aperto')
    if (filterTipo !== 'tutte') s = s.filter(s => s.tipo === filterTipo)
    return s
  }, [seed.scadenze, filterTipo])

  const scadenzePerCliente = useMemo(() => {
    const m: Record<string, typeof scadenzeFiltered> = {}
    scadenzeFiltered.forEach(s => {
      if (s.cliente) {
        if (!m[s.cliente]) m[s.cliente] = []
        m[s.cliente].push(s)
      }
    })
    return m
  }, [scadenzeFiltered])

  // Clienti attivi con attività nell'anno selezionato
  const clientiAnno = useMemo(() => {
    return seed.clienti.filter(c => {
      if (c.stato === 'concluso') return false
      // Ha contratto che copre l'anno selezionato
      const scad = c.scadenza_contratto ? new Date(c.scadenza_contratto) : null
      if (scad && scad.getFullYear() >= annoSelezionato) return true
      if (!scad && c.stato === 'attivo') return true
      // Ha scadenze nell'anno selezionato
      const scadenzeCliente = scadenzePerCliente[c.id] ?? []
      return scadenzeCliente.some(s => new Date(s.data).getFullYear() === annoSelezionato)
    })
  }, [seed.clienti, annoSelezionato, scadenzePerCliente])

  const tipoTabs = [
    { id: 'tutte', label: 'Tutte' },
    { id: 'rinnovo', label: 'Rinnovi' },
    { id: 'rilascio', label: 'Rilasci' },
    { id: 'riunione_cliente', label: 'Riunioni' },
    { id: 'interno', label: 'Interne' },
  ]

  return (
    <div>
      {/* Selezione anno + filtri */}
      <div className="flex items-center justify-between mb-5">
        {/* Anno */}
        <div className="flex items-center gap-3">
          <button onClick={() => setAnnoSelezionato(a => Math.max(a - 1, annoMin))}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
            disabled={annoSelezionato <= annoMin}>
            ‹
          </button>
          <div className="text-center min-w-20">
            <p className="text-lg font-bold text-gray-900">{annoSelezionato}</p>
            <p className="text-xs text-gray-400">{clientiAnno.length} clienti attivi</p>
          </div>
          <button onClick={() => setAnnoSelezionato(a => Math.min(a + 1, annoMax))}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
            disabled={annoSelezionato >= annoMax}>
            ›
          </button>
        </div>

        {/* Filtri tipo */}
        <div className="flex gap-1 flex-wrap">
          {tipoTabs.map(t => (
            <button key={t.id} onClick={() => setFilterTipo(t.id as FilterTipo)}
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

        {/* Legenda */}
        <div className="flex items-center gap-3">
          {[['rinnovo', 'Rinnovo'], ['rilascio', 'Rilascio'], ['riunione_cliente', 'Riunione']].map(([tipo, label]) => (
            <span key={tipo} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: TIPO_COLOR[tipo] }} />
              {label}
            </span>
          ))}
          {oggiPct >= 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-4 border-t-2 border-dashed inline-block" style={{ borderColor: '#1D9E75' }} />
              Oggi
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header mesi */}
        <div className="flex border-b border-gray-200" style={{ paddingLeft: 176 }}>
          {mesi.map((m, i) => (
            <div key={i} className="flex-1 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide py-2.5"
              style={{ borderLeft: i > 0 ? '1px solid #F0F0F0' : 'none' }}>
              {m.label}
            </div>
          ))}
        </div>

        {/* Righe clienti */}
        {clientiAnno.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Nessun cliente attivo nel {annoSelezionato}
          </div>
        ) : clientiAnno.map((cliente, ci) => {
          const referente = personaById[cliente.referente]
          const scadenze = scadenzePerCliente[cliente.id] ?? []
          const isHovered = hoveredCliente === cliente.id

          const contrEnd = cliente.scadenza_contratto ? new Date(cliente.scadenza_contratto) : rangeEnd
          const barLeft = 0
          const barRight = pct(contrEnd)
          const barColor = referente?.colore ?? '#7DF5DF'

          return (
            <div key={cliente.id}
              className="flex items-center border-b border-gray-100 last:border-0"
              style={{ minHeight: 48, background: isHovered ? '#F8FFFE' : ci % 2 === 0 ? 'white' : '#FAFAFA' }}
              onMouseEnter={() => setHoveredCliente(cliente.id)}
              onMouseLeave={() => setHoveredCliente(null)}>

              {/* Nome cliente */}
              <div className="flex items-center gap-2 px-3 flex-shrink-0" style={{ width: 176, borderRight: '1px solid #F0F0F0' }}>
                {referente && (
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ background: referente.colore, fontSize: 9 }}>
                    {referente.nome.charAt(0)}
                  </span>
                )}
                <button onClick={() => onClienteClick?.(cliente.id)}
                  className="text-xs font-medium text-gray-900 hover:text-teal-600 hover:underline text-left truncate flex-1">
                  {cliente.nome}
                </button>
              </div>

              {/* Area Gantt */}
              <div className="flex-1 relative" style={{ height: 48 }}>
                {/* Linee verticali mesi */}
                {mesi.map((_, i) => i > 0 && (
                  <div key={i} className="absolute top-0 bottom-0"
                    style={{ left: `${(i / 12) * 100}%`, borderLeft: '1px solid #F0F0F0' }} />
                ))}

                {/* Linea oggi */}
                {oggiPct >= 0 && oggiPct <= 100 && (
                  <div className="absolute top-0 bottom-0 z-10"
                    style={{ left: `${oggiPct}%`, borderLeft: '2px dashed #1D9E75', opacity: 0.6 }} />
                )}

                {/* Barra contratto */}
                <div className="absolute rounded cursor-pointer hover:opacity-90 transition-opacity"
                  style={{
                    left: `${barLeft}%`,
                    width: `${Math.max(Math.min(barRight, 100) - barLeft, 1)}%`,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    height: 14,
                    background: barColor + '25',
                    border: `1.5px solid ${barColor}60`,
                  }}
                  onClick={() => onClienteClick?.(cliente.id)}
                />

                {/* Marker scadenze */}
                {scadenze.map(s => {
                  const d = new Date(s.data)
                  if (d < rangeStart || d > rangeEnd) return null
                  const left = pct(d)
                  const color = TIPO_COLOR[s.tipo] ?? '#888780'
                  return (
                    <div key={s.id}
                      className="absolute z-20 cursor-pointer group"
                      style={{ left: `${left}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                      onClick={() => onClienteClick?.(cliente.id)}>
                      <div
                        className="w-3 h-3 rotate-45 transition-transform group-hover:scale-150"
                        style={{ background: color, border: '1.5px solid white', boxShadow: `0 0 0 1.5px ${color}` }}
                      />
                      <div className="absolute z-30 bg-gray-900 text-white text-xs rounded-lg px-2 py-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                        style={{ bottom: '140%', left: '50%', transform: 'translateX(-50%)' }}>
                        <p className="font-semibold">{s.titolo}</p>
                        {s.progetto_id && progettoById[s.progetto_id] && (
                          <p className="text-white/60 text-xs mt-0.5">{progettoById[s.progetto_id]}</p>
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
    </div>
  )
}

// ── Lista ─────────────────────────────────────────────────────────────────

function ListaView({ seed }: { seed: Seed }) {
  const [filterTipo, setFilterTipo] = useState<FilterTipo>('tutte')
  const [filterReferente, setFilterReferente] = useState('tutti')
  const [filterMese, setFilterMese] = useState('tutti')

  const personaById = useMemo(() => {
    const m: Record<string, Persona> = {}
    seed.team.forEach(p => { m[p.id] = p })
    return m
  }, [seed.team])

  const clienteById = useMemo(() => {
    const m: Record<string, string> = {}
    seed.clienti.forEach(c => { m[c.id] = c.nome })
    return m
  }, [seed.clienti])

  const progettoById = useMemo(() => {
    const m: Record<string, string> = {}
    ;(seed.progetti ?? []).forEach(p => { m[p.id] = p.nome })
    return m
  }, [seed.progetti])

  const critiche = useMemo(() =>
    seed.scadenze.filter(s => { const d = daysUntil(s.data); return d !== null && d <= 30 && d >= 0 && s.stato === 'aperto' }).length
  , [seed.scadenze])

  const inScadenza = useMemo(() =>
    seed.scadenze.filter(s => { const d = daysUntil(s.data); return d !== null && d <= 90 && d >= 0 && s.stato === 'aperto' }).length
  , [seed.scadenze])

  const rinnoviH2 = useMemo(() =>
    seed.scadenze.filter(s => s.tipo === 'rinnovo' && s.stato === 'aperto').length
  , [seed.scadenze])

  const scadenzeFiltered = useMemo(() => {
    let list = seed.scadenze.filter(s => s.stato === 'aperto')
    if (filterTipo !== 'tutte') list = list.filter(s => s.tipo === filterTipo)
    if (filterReferente !== 'tutti') list = list.filter(s => s.referente === filterReferente)
    if (filterMese !== 'tutti') list = list.filter(s => {
      const d = new Date(s.data)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === filterMese
    })
    return list.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
  }, [seed.scadenze, filterTipo, filterReferente, filterMese])

  const grouped = useMemo(() => {
    const groups: Record<string, { label: string; items: Scadenza[] }> = {}
    scadenzeFiltered.forEach(s => {
      const d = new Date(s.data)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!groups[key]) groups[key] = { label: d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }), items: [] }
      groups[key].items.push(s)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [scadenzeFiltered])

  const mesiDisponibili = useMemo(() => {
    const seen = new Set<string>()
    seed.scadenze.forEach(s => {
      const d = new Date(s.data)
      seen.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    })
    return Array.from(seen).sort().map(key => ({
      value: key,
      label: new Date(key + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    }))
  }, [seed.scadenze])

  const tabs = [
    { id: 'tutte', label: 'Tutte' },
    { id: 'rinnovo', label: 'Rinnovi' },
    { id: 'rilascio', label: 'Rilasci' },
    { id: 'riunione_cliente', label: 'Riunioni' },
    { id: 'interno', label: 'Interne' },
  ]

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Imminenti (entro 30gg)" value={critiche} sub="Richiedono azione immediata" accent="#E53935" />
        <StatCard label="In scadenza (entro 90gg)" value={inScadenza} sub="Da pianificare" accent="#F9A825" />
        <StatCard label="Rinnovi H2 2026" value={rinnoviH2} sub="Totale da gestire" accent="#4F86C6" />
      </div>

      <Tabs tabs={tabs as any} active={filterTipo} onChange={id => setFilterTipo(id as FilterTipo)} />

      <div className="flex gap-3 mb-6 -mt-2">
        <select value={filterReferente} onChange={e => setFilterReferente(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
          <option value="tutti">Tutti i referenti</option>
          {seed.team.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={filterMese} onChange={e => setFilterMese(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
          <option value="tutti">Tutti i mesi</option>
          {mesiDisponibili.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {grouped.length === 0 ? <EmptyState message="Nessuna scadenza" /> : (
        <div className="space-y-6">
          {grouped.map(([key, group]) => (
            <div key={key}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-semibold text-gray-900 capitalize">{group.label}</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {group.items.length} {group.items.length === 1 ? 'scadenza' : 'scadenze'}
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map(s => {
                  const days = daysUntil(s.data)
                  const referente = personaById[s.referente]
                  const borderColor = s.urgenza === 'critica' ? '#E53935' : s.urgenza === 'alta' ? '#F9A825' : 'transparent'
                  return (
                    <div key={s.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4"
                      style={{ borderLeft: `4px solid ${borderColor}` }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <BadgeScadenzaTipo tipo={s.tipo} />
                        </div>
                        <p className="font-semibold text-sm text-gray-900">{s.titolo}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.cliente && <span className="text-xs text-gray-400">{clienteById[s.cliente] ?? s.cliente}</span>}
                          {s.progetto_id && <span className="text-xs text-gray-300">·</span>}
                          {s.progetto_id && <span className="text-xs text-gray-400 italic">{progettoById[s.progetto_id] ?? ''}</span>}
                        </div>
                        {s.note && <p className="text-xs text-gray-400 mt-1.5 italic">{s.note}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{formatDate(s.data)}</p>
                          {days !== null && (
                            <p className="text-xs" style={{ color: days < 0 ? '#9CA3AF' : days <= 30 ? '#C62828' : days <= 90 ? '#F57F17' : '#6B7280' }}>
                              {days < 0 ? `${Math.abs(days)}gg fa` : days === 0 ? 'Oggi' : `tra ${days}gg`}
                            </p>
                          )}
                        </div>
                        {referente && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ background: referente.colore }}>{referente.nome.charAt(0)}</span>
                            <span className="text-xs text-gray-400">{referente.nome.split(' ')[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────

export default function ScadenzeView({ seed, onClienteClick }: ScadenzeProps) {
  const [mainView, setMainView] = useState<MainView>('lista')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <SectionHeader title="Scadenze e milestone" />
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#F1F5F9' }}>
          <button onClick={() => setMainView('lista')}
            className="text-sm px-3 py-1.5 rounded-md transition-colors font-medium"
            style={{
              background: mainView === 'lista' ? 'white' : 'transparent',
              color: mainView === 'lista' ? '#1A1A2E' : '#94A3B8',
              boxShadow: mainView === 'lista' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            Lista
          </button>
          <button onClick={() => setMainView('calendario')}
            className="text-sm px-3 py-1.5 rounded-md transition-colors font-medium"
            style={{
              background: mainView === 'calendario' ? 'white' : 'transparent',
              color: mainView === 'calendario' ? '#1A1A2E' : '#94A3B8',
              boxShadow: mainView === 'calendario' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            Gantt
          </button>
        </div>
      </div>

      {mainView === 'lista' && <ListaView seed={seed} />}
      {mainView === 'calendario' && <CalendarioView seed={seed} onClienteClick={onClienteClick} />}
    </div>
  )
}
