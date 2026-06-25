import React, { useState, useMemo } from 'react'
import { Seed, Persona, Scadenza, ScadenzaTipo } from '../types'
import { daysUntil, formatDate, TODAY } from '../utils'
import { BadgeScadenzaTipo, StatCard, SectionHeader, Tabs, EmptyState } from '../components/UI'

interface ScadenzeProps {
  seed: Seed
}

type FilterTipo = 'tutte' | ScadenzaTipo

export default function ScadenzeView({ seed }: ScadenzeProps) {
  const [filterTipo, setFilterTipo] = useState<FilterTipo>('tutte')
  const [filterReferente, setFilterReferente] = useState<string>('tutti')
  const [filterMese, setFilterMese] = useState<string>('tutti')

  const personaById = useMemo(() => {
    const map: Record<string, Persona> = {}
    seed.team.forEach(p => { map[p.id] = p })
    return map
  }, [seed.team])

  const clienteById = useMemo(() => {
    const map: Record<string, string> = {}
    seed.clienti.forEach(c => { map[c.id] = c.nome })
    return map
  }, [seed.clienti])

  // Counter cards
  const critiche = useMemo(() =>
    seed.scadenze.filter(s => {
      const d = daysUntil(s.data)
      return d !== null && d <= 30 && d >= 0 && s.stato === 'aperto'
    }).length
  , [seed.scadenze])

  const inScadenza = useMemo(() =>
    seed.scadenze.filter(s => {
      const d = daysUntil(s.data)
      return d !== null && d <= 90 && d >= 0 && s.stato === 'aperto'
    }).length
  , [seed.scadenze])

  const rinnoviH2 = useMemo(() =>
    seed.scadenze.filter(s => s.tipo === 'rinnovo' && s.stato === 'aperto').length
  , [seed.scadenze])

  // Filtra scadenze
  const scadenzeFiltered = useMemo(() => {
    let list = seed.scadenze.filter(s => s.stato === 'aperto')

    if (filterTipo !== 'tutte') {
      list = list.filter(s => s.tipo === filterTipo)
    }
    if (filterReferente !== 'tutti') {
      list = list.filter(s => s.referente === filterReferente)
    }
    if (filterMese !== 'tutti') {
      list = list.filter(s => {
        const d = new Date(s.data)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === filterMese
      })
    }

    return list.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
  }, [seed.scadenze, filterTipo, filterReferente, filterMese])

  // Raggruppa per mese
  const grouped = useMemo(() => {
    const groups: Record<string, { label: string; items: Scadenza[] }> = {}
    scadenzeFiltered.forEach(s => {
      const d = new Date(s.data)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!groups[key]) {
        groups[key] = {
          label: d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
          items: []
        }
      }
      groups[key].items.push(s)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [scadenzeFiltered])

  // Mesi disponibili per il filtro
  const mesiDisponibili = useMemo(() => {
    const seen = new Set<string>()
    seed.scadenze.forEach(s => {
      const d = new Date(s.data)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      seen.add(key)
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

  const urgenzaBorder: Record<string, string> = {
    critica: '#E53935',
    alta: '#F9A825',
    normale: 'transparent',
  }

  const urgenzaBadge = (u: string, days: number | null) => {
    if (u === 'critica') return (
      <span className="text-xs px-2 py-0.5 rounded font-semibold"
        style={{ backgroundColor: '#FFEBEE', color: '#C62828' }}>
        🔴 Critica {days !== null ? `(${days}gg)` : ''}
      </span>
    )
    if (u === 'alta') return (
      <span className="text-xs px-2 py-0.5 rounded font-semibold"
        style={{ backgroundColor: '#FFFDE7', color: '#F57F17' }}>
        🟡 Alta {days !== null ? `(${days}gg)` : ''}
      </span>
    )
    return null
  }

  return (
    <div>
      <SectionHeader title="Scadenze e milestone" />

      {/* Counter cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Critiche (entro 30gg)"
          value={critiche}
          sub="Richiedono azione immediata"
          accent="#E53935"
        />
        <StatCard
          label="In scadenza (entro 90gg)"
          value={inScadenza}
          sub="Da pianificare"
          accent="#F9A825"
        />
        <StatCard
          label="Rinnovi H2 2026"
          value={rinnoviH2}
          sub="Totale da gestire"
          accent="#4F86C6"
        />
      </div>

      {/* Filtri */}
      <Tabs
        tabs={tabs as any}
        active={filterTipo}
        onChange={id => setFilterTipo(id as FilterTipo)}
      />

      {/* Filtri secondari */}
      <div className="flex gap-3 mb-6 -mt-2">
        <select
          value={filterReferente}
          onChange={e => setFilterReferente(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-wave-grayLight bg-white outline-none"
        >
          <option value="tutti">Tutti i referenti</option>
          {seed.team.map(p => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
        <select
          value={filterMese}
          onChange={e => setFilterMese(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-wave-grayLight bg-white outline-none"
        >
          <option value="tutti">Tutti i mesi</option>
          {mesiDisponibili.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Lista scadenze raggruppate per mese */}
      {grouped.length === 0 ? (
        <EmptyState message="Nessuna scadenza in questo filtro" />
      ) : (
        <div className="space-y-6">
          {grouped.map(([key, group]) => (
            <div key={key}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-semibold text-wave-dark capitalize">{group.label}</h3>
                <span className="text-xs text-wave-gray bg-gray-100 px-2 py-0.5 rounded-full">
                  {group.items.length} {group.items.length === 1 ? 'scadenza' : 'scadenze'}
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map(s => {
                  const days = daysUntil(s.data)
                  const referente = personaById[s.referente]
                  const borderColor = urgenzaBorder[s.urgenza] ?? 'transparent'
                  const isPast = days !== null && days < 0

                  return (
                    <div
                      key={s.id}
                      className="bg-white rounded-xl border border-wave-grayLight p-4 flex gap-4"
                      style={{
                        borderLeft: `4px solid ${borderColor}`,
                        opacity: isPast ? 0.6 : 1,
                      }}
                    >
                      {/* Left: tipo + titolo + cliente */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <BadgeScadenzaTipo tipo={s.tipo} />
                          {urgenzaBadge(s.urgenza, days)}
                        </div>
                        <p className="font-semibold text-sm text-wave-dark">{s.titolo}</p>
                        {s.cliente && (
                          <p className="text-xs text-wave-gray mt-0.5">
                            {clienteById[s.cliente] ?? s.cliente}
                          </p>
                        )}
                        {s.note && (
                          <p className="text-xs text-wave-gray mt-1.5 line-clamp-1 italic">
                            {s.note}
                          </p>
                        )}
                      </div>

                      {/* Right: data + referente */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-wave-dark">{formatDate(s.data)}</p>
                          {days !== null && (
                            <p className="text-xs" style={{
                              color: days < 0 ? '#9CA3AF' : days <= 30 ? '#C62828' : days <= 90 ? '#F57F17' : '#6B7280'
                            }}>
                              {days < 0 ? `${Math.abs(days)}gg fa` : days === 0 ? 'Oggi' : `tra ${days}gg`}
                            </p>
                          )}
                        </div>
                        {referente && (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: referente.colore }}
                            >
                              {referente.nome.charAt(0)}
                            </span>
                            <span className="text-xs text-wave-gray">{referente.nome.split(' ')[0]}</span>
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
