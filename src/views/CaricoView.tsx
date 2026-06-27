import React, { useState, useMemo } from 'react'
import { Seed, Persona } from '../types'
import { SectionHeader } from '../components/UI'

interface CaricoProps {
  seed: Seed
}

const MESI_LABEL = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function PersonaLoadBar({ persona, pianificate, capacita, consuntivate }: {
  persona: Persona
  pianificate: number[]
  capacita: number[]
  consuntivate: number[]
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const maxH = 80

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ background: persona.colore }}>
          {persona.nome.charAt(0)}
        </span>
        <div>
          <p className="font-semibold text-sm text-gray-900">{persona.nome}</p>
          <p className="text-xs text-gray-400">{persona.ruolo}</p>
        </div>
        <div className="ml-auto flex gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block border-2" style={{ borderColor: persona.colore, background: 'transparent' }} />
            Capacità
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: persona.colore, opacity: 0.4 }} />
            Pianificate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: persona.colore }} />
            Effettive
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block bg-red-400" />
            Sovraccarico
          </span>
        </div>
      </div>

      <div className="flex gap-3 items-end">
        {MESI_LABEL.map((mese, i) => {
          const cap = capacita[i] ?? 0
          const plan = pianificate[i] ?? 0
          const cons = consuntivate[i] ?? 0
          const isOver = cons > cap
          const maxVal = Math.max(cap, plan, cons, 1)
          const planH = Math.min((plan / maxVal) * maxH, maxH + 20)
          const consH = Math.min((cons / maxVal) * maxH, maxH)
          const delta = cons - cap

          return (
            <div key={mese} className="flex-1 flex flex-col items-center gap-1 relative"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}>

              {/* Tooltip */}
              {hovered === i && (
                <div className="absolute z-20 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none whitespace-nowrap"
                  style={{ bottom: maxH + 40 }}>
                  <p className="font-semibold mb-1">{mese} 2026</p>
                  <p>Capacità: <strong>{cap}h</strong></p>
                  {plan > 0 && <p>Pianificate: <strong style={{ color: '#94A3B8' }}>{Math.round(plan)}h</strong></p>}
                  <p>Effettive: <strong style={{ color: '#4F86C6' }}>{Math.round(cons)}h</strong></p>
                  {isOver && <p style={{ color: '#FCA5A5' }}>Sovraccarico: <strong>+{Math.round(Math.abs(delta))}h</strong></p>}
                  {!isOver && <p style={{ color: '#86EFAC' }}>Saldo: <strong>+{Math.round(cap - cons)}h</strong></p>}
                </div>
              )}

              {/* Barre */}
              <div className="relative flex items-end gap-0.5" style={{ height: maxH + 24 }}>
                {/* Linea capacità */}
                <div className="absolute left-0 right-0 border-t-2 border-dashed pointer-events-none"
                  style={{ bottom: 0, marginBottom: maxH, borderColor: persona.colore + '60' }} />

                {/* Barra pianificate */}
                <div className="w-5 rounded-t transition-all flex-shrink-0"
                  style={{
                    height: Math.max(planH, 2),
                    background: isOver ? '#FCA5A5' : persona.colore,
                    opacity: 0.5,
                  }} />

                {/* Barra consuntivate sovrapposta */}
                {cons > 0 && (
                  <div className="absolute left-0 w-5 rounded-t"
                    style={{
                      height: Math.max(consH, 2),
                      background: persona.colore,
                      bottom: 0,
                    }} />
                )}
              </div>

              <span className="text-xs text-gray-400">{mese}</span>

              {/* Saldo */}
              {isOver ? (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded w-full text-center"
                  style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                  −{delta}h
                </span>
              ) : (
                <span className="text-xs font-medium text-gray-400 text-center">{plan}h</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── Tabella allocazioni aggregata per cliente ──────────────────────────────

function AllocazioniTabella({ allocazioni, personaById, clienteById, pianificateByPersona, capacitaByPersona, mesiLabel }: {
  allocazioni: any[]
  personaById: Record<string, any>
  clienteById: Record<string, string>
  pianificateByPersona: Record<string, number[]>
  capacitaByPersona: Record<string, number[]>
  mesiLabel: string[]
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Aggrega allocazioni per cliente
  const perCliente = useMemo(() => {
    const m: Record<string, { totali: number[]; righe: any[] }> = {}
    allocazioni.forEach(a => {
      if (!m[a.cliente]) m[a.cliente] = { totali: new Array(12).fill(0), righe: [] }
      m[a.cliente].righe.push(a)
      a.valori.forEach((v: number, i: number) => { m[a.cliente].totali[i] += v })
    })
    return m
  }, [allocazioni])

  const totaleRiga = (valori: number[]) => valori.reduce((s, v) => s + v, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full min-w-max">
        <thead>
          <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E0E0E0' }}>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50" style={{ minWidth: 160 }}>Cliente</th>
            {mesiLabel.map((m, i) => (
              <th key={i} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ minWidth: 50 }}>{m}</th>
            ))}
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ minWidth: 50 }}>Tot</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(perCliente).map(([clienteId, { totali, righe }], ci) => {
            const isExp = expanded.has(clienteId)
            const nomeCliente = clienteById[clienteId] ?? clienteId
            const totale = totaleRiga(totali)

            return (
              <React.Fragment key={clienteId}>
                {/* Riga aggregata cliente */}
                <tr
                  className="cursor-pointer hover:bg-blue-50 transition-colors"
                  style={{ borderBottom: '1px solid #E0E0E0', background: ci % 2 === 0 ? '#FFF' : '#FAFAFA' }}
                  onClick={() => {
                    const next = new Set(expanded)
                    if (isExp) next.delete(clienteId)
                    else next.add(clienteId)
                    setExpanded(next)
                  }}>
                  <td className="px-4 py-2.5 sticky left-0 bg-inherit" style={{ minWidth: 160 }}>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs w-3">{isExp ? '▾' : '▸'}</span>
                      <span className="text-sm font-semibold text-gray-900">{nomeCliente}</span>
                      <span className="text-xs text-gray-400">({righe.length} risorse)</span>
                    </div>
                  </td>
                  {totali.map((v, mi) => (
                    <td key={mi} className="px-3 py-2.5 text-center text-sm font-medium"
                      style={{ color: v > 0 ? '#374151' : '#D1D5DB' }}>
                      {v > 0 ? v : '·'}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center text-sm font-bold text-gray-900">{totale}</td>
                </tr>

                {/* Righe espanse per risorsa */}
                {isExp && righe.map((a, ri) => {
                  const p = personaById[a.persona]
                  const pianificate = pianificateByPersona[a.persona] ?? []
                  const capacita = capacitaByPersona[a.persona] ?? []
                  return (
                    <tr key={`${a.persona}-${ri}`}
                      style={{ borderBottom: '1px solid #F5F5F5', background: '#F8FFFE' }}>
                      <td className="px-4 py-2 sticky left-0 bg-inherit" style={{ minWidth: 160 }}>
                        <div className="flex items-center gap-2 pl-6">
                          {p && (
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ background: p.colore }}>{p.nome.charAt(0)}</span>
                          )}
                          <span className="text-xs text-gray-600">{p?.nome.split(' ')[0] ?? a.persona}</span>
                          <span className="text-xs text-gray-400">{a.area}</span>
                        </div>
                      </td>
                      {a.valori.map((v: number, mi: number) => {
                        const isOver = pianificate[mi] > (capacita[mi] ?? 0)
                        return (
                          <td key={mi} className="px-3 py-2 text-center text-xs"
                            style={{
                              background: v > 0 && isOver ? '#FFEBEE' : undefined,
                              color: v === 0 ? '#D1D5DB' : v > 0 && isOver ? '#B91C1C' : '#6B7280',
                            }}>
                            {v > 0 ? v : '·'}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-center text-xs font-semibold text-gray-600">
                        {totaleRiga(a.valori)}
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function CaricoView({ seed }: CaricoProps) {
  const [filterPersona, setFilterPersona] = useState('tutti')
  const [filterCliente, setFilterCliente] = useState('tutti')

  const operativi = seed.team.filter(p => p.tipo === 'operativo')

  const capacitaByPersona = useMemo(() => {
    const m: Record<string, number[]> = {}
    // Legge capacita_mensile direttamente dal team (12 mesi Gen-Dic)
    seed.team.filter(p => p.tipo === 'operativo').forEach(p => {
      const cap = (p as any).capacita_mensile
      m[p.id] = Array.isArray(cap) && cap.length === 12 ? cap.map(Number) : new Array(12).fill(0)
    })
    return m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(seed.team)])

  const pianificateByPersona = useMemo(() => {
    // Le ore pianificate derivano dai task importati — per ora sono a 0
    // Verranno calcolate automaticamente quando i task saranno caricati
    const m: Record<string, number[]> = {}
    seed.team.filter(p => p.tipo === 'operativo').forEach(p => {
      m[p.id] = new Array(12).fill(0)
    })
    return m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(seed.team)])

  const consuntivateByPersona = useMemo(() => {
    const m: Record<string, number[]> = {}
    // Legge ore_effettive_mensili direttamente dal team
    seed.team.filter(p => p.tipo === 'operativo').forEach(p => {
      const oe = (p as any).ore_effettive_mensili
      m[p.id] = Array.isArray(oe) && oe.length > 0 ? oe.map(Number) : new Array(12).fill(0)
    })
    return m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(seed.team)])

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

  const allocazioniFiltered = useMemo(() => {
    let list = seed.allocazioni
    if (filterPersona !== 'tutti') list = list.filter(a => a.persona === filterPersona)
    if (filterCliente !== 'tutti') list = list.filter(a => a.cliente === filterCliente)
    return list.filter(a => a.valori.some(v => v > 0))
  }, [seed.allocazioni, filterPersona, filterCliente])

  const totaleRiga = (valori: number[]) => valori.reduce((s, v) => s + v, 0)

  return (
    <div>
      <SectionHeader title="Carico Team" />

      {/* Barre */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Carico mensile — Gen–Dic 2026
        </h2>
        {operativi.map(p => (
          <PersonaLoadBar key={p.id} persona={p}
            pianificate={pianificateByPersona[p.id] ?? new Array(12).fill(0)}
            capacita={capacitaByPersona[p.id] ?? new Array(12).fill(0)}
            consuntivate={consuntivateByPersona[p.id] ?? new Array(12).fill(0)}
          />
        ))}
      </div>

      {/* Tabella allocazioni */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Allocazioni per cliente
          </h2>
          <div className="flex gap-2">
            <select value={filterPersona} onChange={e => setFilterPersona(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
              <option value="tutti">Tutte le risorse</option>
              {operativi.map(p => (
                <option key={p.id} value={p.id}>{p.nome.split(' ')[0]}</option>
              ))}
            </select>
            <select value={filterCliente} onChange={e => setFilterCliente(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
              <option value="tutti">Tutti i clienti</option>
              {seed.clienti.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <AllocazioniTabella
          allocazioni={allocazioniFiltered}
          personaById={personaById}
          clienteById={clienteById}
          pianificateByPersona={pianificateByPersona}
          capacitaByPersona={capacitaByPersona}
          mesiLabel={MESI_LABEL}
        />
      </div>
    </div>
  )
}
