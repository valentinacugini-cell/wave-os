import React, { useState, useMemo } from 'react'
import { Persona, Seed, Cliente } from '../types'
import NuovoClienteModal from '../components/NuovoClienteModal'
import { getAlertLevel, getProssimaScadenza, formatDate, daysUntil } from '../utils'
import { SectionHeader, Tabs, EmptyState } from '../components/UI'

interface HomeProps {
  seed: Seed
  currentUser: Persona
  onClienteClick: (id: string) => void
}

type FilterTab = 'tutti' | 'miei' | 'rinnovi' | 'in_attesa'
type SortCol = 'nome' | 'referente' | 'commerciale' | 'scadenza' | 'rinnovo'
type SortDir = 'asc' | 'desc'

export default function HomeView({ seed, currentUser, onClienteClick }: HomeProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('tutti')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('rinnovo')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [showNuovoCliente, setShowNuovoCliente] = useState(false)
  const [nuoviClienti, setNuoviClienti] = useState<Cliente[]>([])

  const personaById = useMemo(() => {
    const map: Record<string, Persona> = {}
    seed.team.forEach(p => { map[p.id] = p })
    return map
  }, [seed.team])

  const clientiWithMeta = useMemo(() => {
    return [...seed.clienti, ...nuoviClienti].map(c => {
      const alertLevel = getAlertLevel(c)
      const prossimaScadenza = getProssimaScadenza(c)
      const giorni = daysUntil(prossimaScadenza)
      return { ...c, alertLevel, prossimaScadenza, giorni }
    })
  }, [seed.clienti, nuoviClienti])

  function handleColClick(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

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
      case 'miei': list = list.filter(c => c.referente === currentUser.id || c.commerciale === currentUser.id); break
      case 'rinnovi': list = list.filter(c => c.alertLevel === 'critica' || c.alertLevel === 'attenzione'); break
      case 'in_attesa': list = list.filter(c => c.stato === 'in_attesa'); break
    }
    return [...list].sort((a, b) => {
      if (sortCol === 'nome') return sortDir === 'asc' ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome)
      if (sortCol === 'referente') { const va = personaById[a.referente]?.nome ?? ''; const vb = personaById[b.referente]?.nome ?? ''; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va) }
      if (sortCol === 'commerciale') { const va = personaById[a.commerciale]?.nome ?? ''; const vb = personaById[b.commerciale]?.nome ?? ''; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va) }
      const da = a.giorni ?? 9999; const db = b.giorni ?? 9999
      return sortDir === 'asc' ? da - db : db - da
    })
  }, [clientiWithMeta, activeTab, searchQuery, currentUser, sortCol, sortDir])

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

  function getRinnovoBadge(c: typeof filteredClienti[0]) {
    if (c.stato === 'in_attesa') return <span className="text-xs text-gray-400">In attesa</span>
    if (c.giorni === null) return <span className="text-xs text-gray-300">—</span>
    if (c.giorni < 0) return <span className="text-xs text-gray-400">Scaduto</span>
    if (c.giorni <= 30) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold" style={{ background: '#FFEBEE', color: '#C62828' }}>🔴 Imminente · {c.giorni}gg</span>
    if (c.giorni <= 60) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold" style={{ background: '#FFF3E0', color: '#E65100' }}>🟠 Da lavorare · {c.giorni}gg</span>
    if (c.giorni <= 90) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ background: '#FFFDE7', color: '#F57F17' }}>🟡 {c.giorni}gg</span>
    return <span className="text-xs" style={{ color: '#43A047' }}>OK</span>
  }

  function ColHeader({ col, label }: { col: SortCol; label: string }) {
    const active = sortCol === col
    return (
      <th onClick={() => handleColClick(col)}
        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 transition-colors">
        <span className="flex items-center gap-1">
          {label}
          <span style={{ color: active ? '#3DD4BE' : '#D1D5DB', fontSize: 9 }}>
            {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </span>
      </th>
    )
  }

  return (
    <div>
      {showNuovoCliente && (
        <NuovoClienteModal
          seed={seed}
          onClose={() => setShowNuovoCliente(false)}
          onSave={(c) => setNuoviClienti(prev => [...prev, c])}
        />
      )}
      <div className="flex items-start justify-between mb-6">
        <SectionHeader title="Clienti attivi" count={seed.clienti.length + nuoviClienti.length} />
        <div className="flex items-center gap-2 mt-0.5">
          <button onClick={() => setShowNuovoCliente(true)}
            className="text-sm px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5"
            style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
            + Nuovo cliente
          </button>
          {critici > 0 && <span className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: '#FFEBEE', color: '#C62828' }}>🔴 {critici} imminenti</span>}
          {attenzione > 0 && <span className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: '#FFF3E0', color: '#E65100' }}>🟠 {attenzione} da lavorare</span>}
        </div>
      </div>

      <div className="mb-4">
        <input type="text" placeholder="Cerca cliente, referente, commerciale..."
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          className="w-full max-w-sm px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white outline-none" />
      </div>

      <Tabs tabs={tabs as any} active={activeTab} onChange={id => setActiveTab(id as FilterTab)} />

      {filteredClienti.length === 0 ? <EmptyState message="Nessun cliente" /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E0E0E0' }}>
                <ColHeader col="nome" label="Cliente" />
                <ColHeader col="referente" label="Referente Wave" />
                <ColHeader col="commerciale" label="Commerciale" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contratto</th>
                <ColHeader col="scadenza" label="Prossima scadenza" />
                <ColHeader col="rinnovo" label="Gestione rinnovo" />
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
                      {referente ? <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: referente.colore }}>{referente.nome.charAt(0)}</span><span className="text-gray-700">{referente.nome.split(' ')[0]}</span></div> : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{commerciale?.nome ?? '—'}</td>
                    <td className="px-4 py-3">{contrattoLabel}</td>
                    <td className="px-4 py-3 text-sm"><span className={isCritica ? 'font-semibold text-red-700' : 'text-gray-700'}>{c.prossimaScadenza ? formatDate(c.prossimaScadenza) : '—'}</span></td>
                    <td className="px-4 py-3">{getRinnovoBadge(c)}</td>
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
