import React, { useState, useMemo } from 'react'
import { Cliente, Persona, Seed } from '../types'
import {
  getAlertLevel, getProssimaScadenza, formatDate,
  daysUntil, alertLevelOrder
} from '../utils'
import {
  BadgeTipo, BadgeAlert, SectionHeader, Tabs, EmptyState
} from '../components/UI'

interface HomeProps {
  seed: Seed
  currentUser: Persona
  onClienteClick: (id: string) => void
}

type FilterTab = 'tutti' | 'miei' | 'rinnovi' | 'in_attesa'

export default function HomeView({ seed, currentUser, onClienteClick }: HomeProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('tutti')
  const [searchQuery, setSearchQuery] = useState('')

  const personaById = useMemo(() => {
    const map: Record<string, Persona> = {}
    seed.team.forEach(p => { map[p.id] = p })
    return map
  }, [seed.team])

  const clientiWithMeta = useMemo(() => {
    return seed.clienti.map(c => {
      const alertLevel = getAlertLevel(c)
      const prossimaScadenza = getProssimaScadenza(c)
      const giorni = daysUntil(prossimaScadenza)
      return { ...c, alertLevel, prossimaScadenza, giorni }
    })
  }, [seed.clienti])

  const filteredClienti = useMemo(() => {
    let list = clientiWithMeta

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        (personaById[c.referente]?.nome.toLowerCase().includes(q)) ||
        (personaById[c.commerciale]?.nome.toLowerCase().includes(q))
      )
    }

    switch (activeTab) {
      case 'miei':
        list = list.filter(c =>
          c.referente === currentUser.id || c.commerciale === currentUser.id
        )
        break
      case 'rinnovi':
        list = list.filter(c => c.alertLevel === 'critica' || c.alertLevel === 'attenzione')
        break
      case 'in_attesa':
        list = list.filter(c => c.stato === 'in_attesa')
        break
    }

    return [...list].sort((a, b) => alertLevelOrder(a.alertLevel) - alertLevelOrder(b.alertLevel))
  }, [clientiWithMeta, activeTab, searchQuery, currentUser])

  const counts = useMemo(() => ({
    tutti: clientiWithMeta.length,
    miei: clientiWithMeta.filter(c =>
      c.referente === currentUser.id || c.commerciale === currentUser.id
    ).length,
    rinnovi: clientiWithMeta.filter(c =>
      c.alertLevel === 'critica' || c.alertLevel === 'attenzione'
    ).length,
    in_attesa: clientiWithMeta.filter(c => c.stato === 'in_attesa').length,
  }), [clientiWithMeta, currentUser])

  const tabs = [
    { id: 'tutti', label: 'Tutti', count: counts.tutti },
    { id: 'miei', label: 'Miei clienti', count: counts.miei },
    { id: 'rinnovi', label: 'Rinnovi imminenti', count: counts.rinnovi },
    { id: 'in_attesa', label: 'In attesa', count: counts.in_attesa },
  ]

  const critici = clientiWithMeta.filter(c => c.alertLevel === 'critica').length
  const attenzione = clientiWithMeta.filter(c => c.alertLevel === 'attenzione').length

  return (
    <div>
      {/* Header + stats sintetiche */}
      <div className="flex items-start justify-between mb-6">
        <SectionHeader title="Clienti attivi" count={seed.clienti.length} />
        {(critici > 0 || attenzione > 0) && (
          <div className="flex gap-2 mt-0.5">
            {critici > 0 && (
              <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ backgroundColor: '#FFEBEE', color: '#C62828' }}>
                🔴 {critici} {critici === 1 ? 'critico' : 'critici'}
              </span>
            )}
            {attenzione > 0 && (
              <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ backgroundColor: '#FFFDE7', color: '#F57F17' }}>
                🟡 {attenzione} in scadenza
              </span>
            )}
          </div>
        )}
      </div>

      {/* Barra ricerca */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Cerca cliente, referente, commerciale..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full max-w-sm px-3 py-2 text-sm rounded-lg border border-wave-grayLight bg-white outline-none focus:border-wave-tealDark"
        />
      </div>

      <Tabs
        tabs={tabs as any}
        active={activeTab}
        onChange={id => setActiveTab(id as FilterTab)}
      />

      {filteredClienti.length === 0 ? (
        <EmptyState message="Nessun cliente in questa categoria" />
      ) : (
        <div className="bg-white rounded-xl border border-wave-grayLight overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F8F9FA', borderBottom: '1px solid #E0E0E0' }}>
                {['Cliente', 'Tipo', 'Referente Wave', 'Commerciale', 'Prossima scadenza', 'Alert'].map(col => (
                  <th key={col} className="text-left px-4 py-3 text-xs font-semibold text-wave-gray uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredClienti.map((c, i) => {
                const referente = personaById[c.referente]
                const commerciale = personaById[c.commerciale]
                const daysLabel = c.giorni !== null
                  ? c.giorni <= 0 ? 'scaduto' : `${c.giorni}gg`
                  : undefined
                const isEven = i % 2 === 0
                const isCritica = c.alertLevel === 'critica'
                return (
                  <tr
                    key={c.id}
                    style={{
                      backgroundColor: isCritica
                        ? '#FFF8F8'
                        : isEven ? '#FFFFFF' : '#FAFAFA',
                      borderBottom: '1px solid #F0F0F0',
                      borderLeft: isCritica ? '3px solid #E53935' : '3px solid transparent',
                    }}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onClienteClick(c.id)}
                        className="font-medium text-sm text-wave-dark hover:text-blue-600 hover:underline transition-colors text-left"
                      >
                        {c.nome}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <BadgeTipo tipo={c.tipo} />
                    </td>
                    <td className="px-4 py-3 text-sm text-wave-dark">
                      {referente ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: referente.colore }}
                          >
                            {referente.nome.charAt(0)}
                          </span>
                          {referente.nome.split(' ')[0]}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-wave-gray">
                      {commerciale ? commerciale.nome.split(' ')[0] + ' ' + commerciale.nome.split(' ')[1] : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {c.prossimaScadenza ? (
                        <span className={isCritica ? 'font-semibold text-red-700' : 'text-wave-dark'}>
                          {formatDate(c.prossimaScadenza)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <BadgeAlert level={c.alertLevel} daysLabel={daysLabel} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
