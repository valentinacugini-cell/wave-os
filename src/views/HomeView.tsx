import React, { useState, useMemo } from 'react'
import { Persona, Seed } from '../types'
import { getAlertLevel, getProssimaScadenza, formatDate, daysUntil, alertLevelOrder } from '../utils'
import { SectionHeader, Tabs, EmptyState } from '../components/UI'

interface HomeProps {
  seed: Seed
  currentUser: Persona
  onClienteClick: (id: string) => void
}

type FilterTab = 'tutti' | 'miei' | 'rinnovi' | 'in_attesa'
type SortMode = 'alert' | 'alfabetico' | 'scadenza'

export default function HomeView({ seed, currentUser, onClienteClick }: HomeProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('tutti')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('alert')

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
        list = list.filter(c => c.referente === currentUser.id || c.commerciale === currentUser.id)
        break
      case 'rinnovi':
        list = list.filter(c => c.alertLevel === 'critica' || c.alertLevel === 'attenzione')
        break
      case 'in_attesa':
        list = list.filter(c => c.stato === 'in_attesa')
        break
    }
    return [...list].sort((a, b) => {
      if (sortMode === 'alfabetico') return a.nome.localeCompare(b.nome)
      if (sortMode === 'scadenza') return (a.giorni ?? 9999) - (b.giorni ?? 9999)
      const ao = alertLevelOrder(a.alertLevel)
      const bo = alertLevelOrder(b.alertLevel)
      if (ao !== bo) return ao - bo
      return (a.giorni ?? 9999) - (b.giorni ?? 9999)
    })
  }, [clientiWithMeta, activeTab, searchQuery, currentUser, sortMode])

  const counts = useMemo(() => ({
    tutti: clientiWithMeta.length,
    miei: clientiWithMeta.filter(c => c.referente === currentUser.id || c.commerciale === currentUser.id).length,
    rinnovi: clientiWithMeta.filter(c => c.alertLevel === 'critica' || c.alertLevel === 'attenzione').length,
    in_attesa: clientiWithMeta.filter(c => c.stato === 'in_attesa').length,
  }), [clientiWithMeta, currentUser])

  const critici = clientiWithMeta.filter(c => c.alertLevel === 'critica').length
  const attenzione = clientiWithMeta.filter(c => c.alertLevel === 'attenzione').length

  const tabs = [
    { id: 'tutti', label: 'Tutti', count: counts.tutti },
    { id: 'miei', label: 'Miei clienti', count: counts.miei },
    { id: 'rinnovi', label: 'Rinnovi imminenti', count: counts.rinnovi },
    { id: 'in_attesa', label: 'In attesa', count: counts.in_attesa },
  ]

  function getAlertBadge(c: typeof filteredClienti[0]) {
    if (c.stato === 'in_attesa') return <span className="text-xs text-gray-400">In attesa</span>
    if (c.giorni === null) return <span className="text-xs text-gray-300">-</span>
    if (c.giorni < 0) return <span className="text-xs text-gray-400">Scaduto</span>
    if (c.giorni <= 30) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold" style={{ background: '#FFEBEE', color: '#C62828' }}>Critico {c.giorni}gg</span>
    if (c.giorni <= 60) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold" style={{ background: '#FFF3E0', color: '#E65100' }}>Attenzione {c.giorni}gg</span>
    if (c.giorni <= 90) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ background: '#FFFDE7', color: '#F57F17' }}>{c.giorni}gg</span>
    return <span className="text-xs text-green-500">OK</span>
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <SectionHeader title="Clienti attivi" count={seed.clienti.length} />
        <div className="flex items-center gap-3 mt-0.5">
          {critici > 0 && <span className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: '#FFEBEE', color: '#C62828' }}>Critici: {critici}</span>}
          {attenzione > 0 && <span className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: '#FFF3E0', color: '#E65100' }}>Attenzione: {attenzione}</span>}
          <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none">
            <option value="alert">Per urgenza</option>
            <option value="scadenza">Per scadenza</option>
            <option value="alfabetico">A-Z</option>
          </select>
        </div>
      </div>
      <div className="mb-4">
        <input type="text" placeholder="Cerca cliente..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full max-w-sm px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white outline-none" />
      </div>
      <Tabs tabs={tabs as any} active={activeTab} onChange={id => setActiveTab(id as FilterTab)} />
      {filteredClienti.length === 0 ? <EmptyState message="Nessun cliente" /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E0E0E0' }}>
                {['Cliente', 'Referente Wave', 'Commerciale', 'Contratto', 'Prossima scadenza', 'Alert'].map(col => (
                  <th key={col} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredClienti.map((c, i) => {
                const referente = personaById[c.referente]
                const commerciale = personaById[c.commerciale]
                const isCritica = c.alertLevel === 'critica'
                const contrattoLabel = c.tipo_contratto === 'ppl'
                  ? <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#F5F3FF', color: '#6D28D9' }}>PPL</span>
                  : <span className="text-xs text-gray-400">Progetto</span>
                return (
                  <tr key={c.id} style={{ background: isCritica ? '#FFF8F8' : i % 2 === 0 ? '#FFF' : '#FAFAFA', borderBottom: '1px solid #F0F0F0', borderLeft: isCritica ? '3px solid #E53935' : '3px solid transparent' }}>
                    <td className="px-4 py-3">
                      <button onClick={() => onClienteClick(c.id)} className="font-medium text-sm text-gray-900 hover:text-teal-600 hover:underline text-left">{c.nome}</button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {referente ? <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: referente.colore }}>{referente.nome.charAt(0)}</span><span className="text-gray-700">{referente.nome.split(' ')[0]}</span></div> : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{commerciale?.nome ?? '-'}</td>
                    <td className="px-4 py-3">{contrattoLabel}</td>
                    <td className="px-4 py-3 text-sm"><span className={isCritica ? 'font-semibold text-red-700' : 'text-gray-700'}>{c.prossimaScadenza ? formatDate(c.prossimaScadenza) : '-'}</span></td>
                    <td className="px-4 py-3">{getAlertBadge(c)}</td>
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
