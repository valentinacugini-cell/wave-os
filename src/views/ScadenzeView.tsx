import React, { useState, useMemo } from 'react'
import { Seed, Persona, Scadenza, ScadenzaTipo } from '../types'
import { daysUntil, formatDate, TODAY } from '../utils'
import { BadgeScadenzaTipo, StatCard, SectionHeader, Tabs, EmptyState } from '../components/UI'

interface ScadenzeProps {
  seed: Seed
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

// ── Calendario ────────────────────────────────────────────────────────────

function CalendarioView({ seed }: { seed: Seed }) {
  const oggi = TODAY
  const [anno, setAnno] = useState(oggi.getFullYear())
  const [mese, setMese] = useState(oggi.getMonth()) // 0-indexed

  const scadenzeAperte = seed.scadenze.filter(s => s.stato === 'aperto')

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

  // Genera i giorni del mese corrente
  const primoGiorno = new Date(anno, mese, 1)
  const ultimoGiorno = new Date(anno, mese + 1, 0)
  const giorniNelMese = ultimoGiorno.getDate()
  // Giorno della settimana del primo giorno (0=Dom, adattiamo a Lun=0)
  const inizioSettimana = (primoGiorno.getDay() + 6) % 7

  // Scadenze per giorno
  const scadenzePerGiorno = useMemo(() => {
    const m: Record<number, Scadenza[]> = {}
    scadenzeAperte.forEach(s => {
      const d = new Date(s.data)
      if (d.getFullYear() === anno && d.getMonth() === mese) {
        const giorno = d.getDate()
        if (!m[giorno]) m[giorno] = []
        m[giorno].push(s)
      }
    })
    return m
  }, [scadenzeAperte, anno, mese])

  const meseLabel = primoGiorno.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  const giorniSettimana = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

  function prevMese() {
    if (mese === 0) { setMese(11); setAnno(a => a - 1) }
    else setMese(m => m - 1)
  }
  function nextMese() {
    if (mese === 11) { setMese(0); setAnno(a => a + 1) }
    else setMese(m => m + 1)
  }

  // Conta scadenze nel mese
  const totMese = Object.values(scadenzePerGiorno).flat().length

  return (
    <div>
      {/* Navigazione mese */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMese}
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
          ‹
        </button>
        <div className="text-center">
          <h3 className="text-base font-semibold text-gray-900 capitalize">{meseLabel}</h3>
          <p className="text-xs text-gray-400">{totMese} scadenze nel mese</p>
        </div>
        <button onClick={nextMese}
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
          ›
        </button>
      </div>

      {/* Griglia calendario */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header giorni settimana */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {giorniSettimana.map(g => (
            <div key={g} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {g}
            </div>
          ))}
        </div>

        {/* Celle giorni */}
        <div className="grid grid-cols-7">
          {/* Celle vuote prima del primo giorno */}
          {Array.from({ length: inizioSettimana }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-24 border-r border-b border-gray-100 bg-gray-50/50" />
          ))}

          {/* Giorni del mese */}
          {Array.from({ length: giorniNelMese }).map((_, i) => {
            const giorno = i + 1
            const dataGiorno = new Date(anno, mese, giorno)
            const isOggi = dataGiorno.toDateString() === oggi.toDateString()
            const isPast = dataGiorno < oggi && !isOggi
            const scadenze = scadenzePerGiorno[giorno] ?? []
            const colIndex = (inizioSettimana + i) % 7
            const isLastCol = colIndex === 6

            return (
              <div key={giorno}
                className="min-h-24 border-b border-gray-100 p-1.5 flex flex-col"
                style={{
                  borderRight: isLastCol ? 'none' : '1px solid #F0F0F0',
                  background: isOggi ? '#F0FDF9' : isPast ? '#FAFAFA' : 'white',
                }}>
                {/* Numero giorno */}
                <div className="flex justify-end mb-1">
                  <span
                    className="w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full"
                    style={{
                      background: isOggi ? '#1D9E75' : 'transparent',
                      color: isOggi ? 'white' : isPast ? '#9CA3AF' : '#374151',
                      fontWeight: isOggi ? 700 : 400,
                    }}>
                    {giorno}
                  </span>
                </div>

                {/* Scadenze del giorno */}
                <div className="flex flex-col gap-0.5 flex-1">
                  {scadenze.slice(0, 3).map(s => {
                    const color = TIPO_COLOR[s.tipo] ?? '#888780'
                    return (
                      <div key={s.id}
                        className="rounded px-1.5 py-0.5 text-xs leading-snug truncate"
                        style={{ background: color + '18', borderLeft: `2px solid ${color}`, color: '#1A1A1A' }}
                        title={s.titolo}>
                        <span className="truncate block" style={{ fontSize: 10 }}>
                          {s.cliente ? (clienteNome[s.cliente] ?? s.titolo) : s.titolo}
                        </span>
                      </div>
                    )
                  })}
                  {scadenze.length > 3 && (
                    <span className="text-xs text-gray-400 px-1">+{scadenze.length - 3}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex gap-4 mt-3 flex-wrap">
        {Object.entries(TIPO_COLOR).map(([tipo, color]) => (
          <span key={tipo} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-3 rounded-sm" style={{ background: color + '40', borderLeft: `2px solid ${color}` }} />
            {tipo === 'rinnovo' ? 'Rinnovo' : tipo === 'rilascio' ? 'Rilascio' : tipo === 'riunione_cliente' ? 'Riunione' : tipo === 'interno' ? 'Interno' : 'Checkpoint'}
          </span>
        ))}
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
                        {s.cliente && <p className="text-xs text-gray-400 mt-0.5">{clienteById[s.cliente] ?? s.cliente}</p>}
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

export default function ScadenzeView({ seed }: ScadenzeProps) {
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
            Calendario
          </button>
        </div>
      </div>

      {mainView === 'lista' && <ListaView seed={seed} />}
      {mainView === 'calendario' && <CalendarioView seed={seed} />}
    </div>
  )
}
