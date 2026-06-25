import React, { useState, useMemo } from 'react'
import { Seed, Persona } from '../types'
import { SectionHeader } from '../components/UI'

interface CaricoProps {
  seed: Seed
}

const MESI_LABEL = ['Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function PersonaLoadBar({ persona, pianificate, capacita, consuntivate, mesiLabel }: {
  persona: Persona
  pianificate: number[]
  capacita: number[]
  consuntivate: number[]
  mesiLabel: string[]
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div className="bg-white rounded-xl border border-wave-grayLight p-5 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: persona.colore }}
        >
          {persona.nome.charAt(0)}
        </span>
        <div>
          <p className="font-semibold text-sm text-wave-dark">{persona.nome}</p>
          <p className="text-xs text-wave-gray">{persona.ruolo}</p>
        </div>
        <div className="ml-auto flex gap-4 text-xs text-wave-gray">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm inline-block" style={{ backgroundColor: persona.colore, opacity: 0.6 }} />
            Pianificate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm inline-block" style={{ backgroundColor: persona.colore }} />
            Consuntivate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm inline-block bg-red-200" />
            Sovraccarico
          </span>
        </div>
      </div>

      <div className="flex gap-2 items-end">
        {mesiLabel.map((mese, i) => {
          const cap = capacita[i] ?? 0
          const plan = pianificate[i] ?? 0
          const cons = consuntivate[i] ?? 0
          const isOver = plan > cap
          const maxH = 80
          const planH = cap > 0 ? Math.min((plan / cap) * maxH, maxH + 20) : 0
          const capH = maxH
          const consH = cap > 0 ? Math.min((cons / cap) * maxH, maxH) : 0
          const isHovered = hovered === i

          return (
            <div
              key={mese}
              className="flex-1 flex flex-col items-center gap-1 cursor-default"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute z-10 bg-wave-dark text-white text-xs rounded-lg px-3 py-2 shadow-lg -translate-y-2 pointer-events-none whitespace-nowrap"
                  style={{ marginTop: -120 }}>
                  <p className="font-semibold mb-1">{mese} 2026</p>
                  <p>Capacità: <strong>{cap}h</strong></p>
                  <p>Pianificate: <strong style={{ color: isOver ? '#FCA5A5' : '#7DF5DF' }}>{plan}h</strong></p>
                  {cons > 0 && <p>Consuntivate: <strong>{cons}h</strong></p>}
                  {isOver && <p style={{ color: '#FCA5A5' }}>Surplus: <strong>−{plan - cap}h</strong></p>}
                </div>
              )}

              {/* Barre */}
              <div className="relative flex items-end gap-0.5" style={{ height: maxH + 20 }}>
                {/* Linea capacità */}
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-gray-300 pointer-events-none"
                  style={{ bottom: 0, height: 0, marginBottom: capH }}
                />
                {/* Barra pianificate */}
                <div
                  className="w-5 rounded-t transition-all"
                  style={{
                    height: planH,
                    backgroundColor: isOver ? '#EF4444' : persona.colore,
                    opacity: 0.7,
                  }}
                />
                {/* Barra consuntivate (sovrapposta, più scura) */}
                {cons > 0 && (
                  <div
                    className="absolute left-0 w-5 rounded-t"
                    style={{
                      height: consH,
                      backgroundColor: persona.colore,
                      bottom: 0,
                    }}
                  />
                )}
              </div>

              {/* Label mese */}
              <span className="text-xs text-wave-gray">{mese}</span>
              {/* Ore */}
              <span
                className="text-xs font-medium"
                style={{ color: isOver ? '#EF4444' : '#666666' }}
              >
                {plan}h
              </span>
            </div>
          )
        })}
      </div>

      {/* Sintesi overflow */}
      {pianificate.some((p, i) => p > (capacita[i] ?? 0)) && (
        <div className="mt-3 pt-3 border-t border-wave-grayLight">
          <div className="flex flex-wrap gap-2">
            {pianificate.map((p, i) => {
              const cap = capacita[i] ?? 0
              if (p <= cap) return null
              return (
                <span key={i} className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ backgroundColor: '#FFEBEE', color: '#C62828' }}>
                  {MESI_LABEL[i]}: −{p - cap}h
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CaricoView({ seed }: CaricoProps) {
  const [filterPersona, setFilterPersona] = useState<string>('tutti')

  const operativi = seed.team.filter(p => p.tipo === 'operativo')

  const capacitaByPersona = useMemo(() => {
    const map: Record<string, number[]> = {}
    seed.capacita.forEach(r => { map[r.persona] = r.valori })
    return map
  }, [seed.capacita])

  const pianificateByPersona = useMemo(() => {
    const map: Record<string, number[]> = {}
    seed.ore_pianificate.forEach(r => { map[r.persona] = r.valori })
    return map
  }, [seed.ore_pianificate])

  const consuntivateByPersona = useMemo(() => {
    const map: Record<string, number[]> = {}
    seed.ore_consuntivate.forEach(r => { map[r.persona] = r.valori })
    return map
  }, [seed.ore_consuntivate])

  const personaById = useMemo(() => {
    const map: Record<string, Persona> = {}
    seed.team.forEach(p => { map[p.id] = p })
    return map
  }, [seed.team])

  // Tabella allocazioni filtrata
  const allocazioniFiltered = useMemo(() => {
    let list = seed.allocazioni
    if (filterPersona !== 'tutti') {
      list = list.filter(a => a.persona === filterPersona)
    }
    return list.filter(a => a.valori.some(v => v > 0))
  }, [seed.allocazioni, filterPersona])

  const clienteById = useMemo(() => {
    const map: Record<string, string> = {}
    seed.clienti.forEach(c => { map[c.id] = c.nome })
    return map
  }, [seed.clienti])

  // Totali per riga
  const totaleRiga = (valori: number[]) => valori.reduce((s, v) => s + v, 0)

  return (
    <div>
      <SectionHeader title="Carico Team" />

      {/* Sezione A — Barre per persona */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-wave-gray uppercase tracking-wide mb-4">
          Carico mensile per risorsa — Giu–Dic 2026
        </h2>
        {operativi.map(p => (
          <PersonaLoadBar
            key={p.id}
            persona={p}
            pianificate={pianificateByPersona[p.id] ?? new Array(7).fill(0)}
            capacita={capacitaByPersona[p.id] ?? new Array(7).fill(0)}
            consuntivate={consuntivateByPersona[p.id] ?? new Array(7).fill(0)}
            mesiLabel={MESI_LABEL}
          />
        ))}
      </div>

      {/* Sezione B — Tabella allocazioni */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-wave-gray uppercase tracking-wide">
            Allocazioni per cliente
          </h2>
          <select
            value={filterPersona}
            onChange={e => setFilterPersona(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-wave-grayLight bg-white outline-none"
          >
            <option value="tutti">Tutte le risorse</option>
            {operativi.map(p => (
              <option key={p.id} value={p.id}>{p.nome.split(' ')[0]}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-wave-grayLight overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr style={{ backgroundColor: '#F8F9FA', borderBottom: '1px solid #E0E0E0' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold text-wave-gray uppercase tracking-wide sticky left-0 bg-gray-50 min-w-36">
                  Cliente
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-wave-gray uppercase tracking-wide min-w-24">
                  Risorsa
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-wave-gray uppercase tracking-wide min-w-20">
                  Area
                </th>
                {MESI_LABEL.map((m, i) => (
                  <th key={i} className="text-center px-3 py-3 text-xs font-semibold text-wave-gray uppercase tracking-wide min-w-12">
                    {m}
                  </th>
                ))}
                <th className="text-center px-3 py-3 text-xs font-semibold text-wave-gray uppercase tracking-wide min-w-14">
                  Tot
                </th>
              </tr>
            </thead>
            <tbody>
              {allocazioniFiltered.map((a, i) => {
                const p = personaById[a.persona]
                const pianificate = pianificateByPersona[a.persona] ?? []
                const capacita = capacitaByPersona[a.persona] ?? []

                return (
                  <tr
                    key={`${a.cliente}-${a.persona}-${i}`}
                    style={{
                      borderBottom: '1px solid #F0F0F0',
                      backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                    }}
                  >
                    <td className="px-4 py-2.5 text-sm font-medium text-wave-dark sticky left-0 bg-inherit">
                      {clienteById[a.cliente] ?? a.cliente}
                    </td>
                    <td className="px-3 py-2.5">
                      {p && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: p.colore }}
                          >
                            {p.nome.charAt(0)}
                          </span>
                          <span className="text-xs text-wave-dark">{p.nome.split(' ')[0]}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-wave-gray">{a.area}</span>
                    </td>
                    {a.valori.map((v, mi) => {
                      const isOver = pianificate[mi] > (capacita[mi] ?? 0)
                      return (
                        <td
                          key={mi}
                          className="px-3 py-2.5 text-center text-sm"
                          style={{
                            backgroundColor: v > 0 && isOver ? '#FFEBEE' : undefined,
                            color: v === 0 ? '#D1D5DB' : v > 0 && isOver ? '#B91C1C' : '#374151',
                            fontWeight: v > 0 ? 500 : 400,
                          }}
                        >
                          {v > 0 ? v : '·'}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2.5 text-center text-sm font-semibold text-wave-dark">
                      {totaleRiga(a.valori)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
