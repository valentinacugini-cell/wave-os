import React, { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { Seed, Persona, Task, TaskStato, TaskPriorita, Contatto, Progetto } from '../types'
import { formatDate, daysUntil, getAlertLevel, getProssimaScadenza } from '../utils'
import { BadgeTipo, BadgeAlert, BadgeScadenzaTipo } from '../components/UI'
import { useTaskContext } from '../context/TaskContext'
import { useClienteContext } from '../context/ClienteContext'
import { sbPatch, sbPost } from '../lib/supabase'
import TaskModal from '../components/TaskModal'
import ImportTaskModal from '../components/ImportTaskModal'

interface Props {
  clienteId: string
  seed: Seed
  onBack: () => void
}

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

function getStat(stato: string) {
  return STATI_LABEL[stato as TaskStato] ?? STATI_LABEL['da_fare']
}
function getPrio(priorita: string) {
  return PRIO[priorita as TaskPriorita] ?? PRIO['media']
}

const areaColors: Record<string, string> = {
  Dev: '#4F86C6', ADV: '#A67DC6', Content: '#7DC67D',
  Strategia: '#E07B54', Grafica: '#F9A825', Gestione: '#9CA3AF',
}

export default function SchedaCliente({ clienteId, seed, onBack }: Props) {
  const [progettoSelezionato, setProgettoSelezionato] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'attivita' | 'scadenze' | 'rinnovo' | 'anagrafica'>('attivita')
  const [filtroStato, setFiltroStato] = useState<'aperti' | 'tutti'>('aperti')
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [activeTaskModal, setActiveTaskModal] = useState<Task | null>(null)
  const [notaEdit, setNotaEdit] = useState<string | null>(null)
  const [anagraficaEdit, setAnagraficaEdit] = useState(false)
  const [contrattoEdit, setContrattoEdit] = useState(false)
  const [showNuovoProgetto, setShowNuovoProgetto] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [contrattoForm, setContrattoForm] = useState({
    scadenza: '',
    rinnovo: '',
    lead_obiettivo: '',
    lead_raccolte: '',
  })
  const [taskImportati, setTaskImportati] = useState<any[]>([])
  const [selezione, setSelezione] = useState<Set<string>>(new Set())

  const { getTask, updateTask, eliminaTask, isEliminato } = useTaskContext()

  async function handleSalvaContratto() {
    const updates: any = {}
    if (contrattoForm.scadenza) updates.scadenza_contratto = contrattoForm.scadenza
    if (contrattoForm.rinnovo) updates.rinnovo_previsto = contrattoForm.rinnovo
    if (contrattoForm.lead_obiettivo) updates.lead_obiettivo = Number(contrattoForm.lead_obiettivo)
    if (contrattoForm.lead_raccolte) updates.lead_raccolte = Number(contrattoForm.lead_raccolte)
    try {
      await sbPatch('clienti', clienteId, updates)
      updateCliente(clienteId, updates)
      setContrattoEdit(false)
    } catch(e) {
      console.error('Salvataggio contratto:', e)
      // Salvo comunque in sessione
      updateCliente(clienteId, updates)
      setContrattoEdit(false)
    }
  }
  const { getCliente, getContatti, updateCliente, updateNoteRinnovo, getNoteRinnovo } = useClienteContext()

  const clienteBase = seed.clienti.find(c => c.id === clienteId)
  const cliente = clienteBase ? getCliente(clienteBase) : undefined

  const personaById = useMemo(() => {
    const m: Record<string, Persona> = {}
    seed.team.forEach(p => { m[p.id] = p })
    return m
  }, [seed.team])

  // Progetti del cliente
  const progetti = useMemo(() =>
    seed.progetti.filter(p => p.cliente === clienteId)
  , [seed.progetti, clienteId])

  // Progetto attivo (primo di default)
  const progettoAttivo: Progetto | null = useMemo(() => {
    if (progetti.length === 0) return null
    const id = progettoSelezionato ?? progetti[0].id
    return progetti.find(p => p.id === id) ?? progetti[0]
  }, [progetti, progettoSelezionato])

  // Task filtrati per progetto
  const tasksCliente = [...seed.tasks.filter(t => t.cliente === clienteId), ...taskImportati.filter(t => t.cliente === clienteId)].filter(t => !isEliminato(t.id))
  const tasks = progettoAttivo
    ? tasksCliente.filter(t => t.progetto_id === progettoAttivo.id)
    : tasksCliente

  const tasksConEdits = tasks.map(t => getTask(t))

  const tasksFiltrati = filtroStato === 'aperti'
    ? tasksConEdits.filter(t => t.stato !== 'completato')
    : tasksConEdits

  // Scadenze filtrate per progetto
  const scadenzeCliente = seed.scadenze.filter(s => s.cliente === clienteId)
  const scadenze = progettoAttivo
    ? scadenzeCliente.filter(s => !s.progetto_id || s.progetto_id === progettoAttivo.id)
    : scadenzeCliente

  const contattiBase = ((seed.contatti ?? []) as Contatto[]).filter(c => c.cliente === clienteId)
  const contatti = getContatti(clienteId, contattiBase)
  const noteRinnovoBase = seed.note_rinnovo?.find(n => n.cliente === clienteId)
  const noteRinnovoText = getNoteRinnovo(clienteId, noteRinnovoBase?.note)

  const allocazioni = seed.allocazioni.filter(a => a.cliente === clienteId)

  if (!cliente) return <div className="p-8 text-gray-500">Cliente non trovato</div>

  const referente = personaById[cliente.referente]
  const commerciale = personaById[cliente.commerciale]
  const alertLevel = getAlertLevel(cliente)
  const prossimaScadenza = getProssimaScadenza(cliente)
  const giorni = daysUntil(prossimaScadenza)

  // Ore: contratto vs allocate vs saldo
  const oreContratto = progettoAttivo?.ore_contratto ?? 0
  const risorseUniche = [...new Set(allocazioni.map(a => a.persona))]
  const oreAllocateTotali = allocazioni.reduce((s, a) => s + a.valori.reduce((x, v) => x + v, 0), 0)
  const oreSaldo = oreContratto - oreAllocateTotali

  // Dati grafico a barre mensile
  const mesiLabel = seed.mesi_label
  const barData = mesiLabel.map((mese, mi) => {
    const allocate = allocazioni.reduce((s, a) => s + (a.valori[mi] ?? 0), 0)
    return { mese, allocate, contratto: Math.round(oreContratto / 7) }
  }).filter(d => d.allocate > 0 || d.contratto > 0)

  // Torta ore per risorsa
  const pieDataRisorsa = risorseUniche.map(pid => {
    const ore = allocazioni.filter(a => a.persona === pid).reduce((s, a) => s + a.valori.reduce((x, v) => x + v, 0), 0)
    const p = personaById[pid]
    return { name: p?.nome.split(' ')[0] ?? pid, value: ore, colore: p?.colore ?? '#ccc' }
  }).filter(d => d.value > 0)

  // Torta ore per area
  const areeUniche = [...new Set(allocazioni.map(a => a.area))]
  const pieDataArea = areeUniche.map(area => {
    const ore = allocazioni.filter(a => a.area === area).reduce((s, a) => s + a.valori.reduce((x, v) => x + v, 0), 0)
    return { name: area, value: ore, colore: areaColors[area] ?? '#ccc' }
  }).filter(d => d.value > 0)

  // Task stats
  const totTask = tasksConEdits.length
  const completati = tasksConEdits.filter(t => t.stato === 'completato').length
  const pctCompletamento = totTask > 0 ? Math.round((completati / totTask) * 100) : 0
  const taskBloccati = tasksConEdits.filter(t => t.stato === 'bloccato' || t.stato === 'in_attesa_materiali').length

  // PPL progress
  const isPPL = cliente.tipo_contratto === 'ppl'
  const leadObiettivo = cliente.lead_obiettivo ?? 0
  const leadRaccolte = cliente.lead_raccolte ?? 0
  const pctLead = leadObiettivo > 0 ? Math.round((leadRaccolte / leadObiettivo) * 100) : 0

  return (
    <div>
      {/* NuovoProgettoModal */}
      {showNuovoProgetto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNuovoProgetto(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
              style={{ background: '#F8F9FA' }}>
              <h2 className="text-base font-semibold text-gray-900">Nuovo progetto — {cliente.nome}</h2>
              <button onClick={() => setShowNuovoProgetto(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200">✕</button>
            </div>
            <NuovoProgettoForm
              clienteId={clienteId}
              clienteNome={cliente.nome}
              onClose={() => setShowNuovoProgetto(false)}
            />
          </div>
        </div>
      )}

      {/* ImportTaskModal */}
      {showImport && (
        <ImportTaskModal
          progetti={progetti}
          personaById={personaById}
          clienteId={clienteId}
          onClose={() => setShowImport(false)}
          onImport={(nuoviTask) => {
            setTaskImportati(prev => [...prev, ...nuoviTask.map((t, i) => ({ ...t, id: `imp_${Date.now()}_${i}` }))])
            setShowImport(false)
          }}
        />
      )}

      {/* TaskModal */}
      {activeTaskModal && (
        <TaskModal
          task={getTask(activeTaskModal)}
          personaById={personaById}
          clienteNome={cliente.nome}
          progetti={progetti}
          onClose={() => setActiveTaskModal(null)}
          onSave={(id, updates) => { updateTask(id, updates); setActiveTaskModal(null) }}
        />
      )}

      <button onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        ← Tutti i clienti
      </button>

      {/* Tab progetto — solo se più di un progetto */}
      {progetti.length > 0 && (
        <div className="flex items-center gap-2 mb-5 overflow-x-auto">
          {progetti.map(p => (
            <button key={p.id}
              onClick={() => { setProgettoSelezionato(p.id); setActiveTab('attivita') }}
              className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all border"
              style={{
                background: progettoAttivo?.id === p.id ? '#1A1A2E' : 'white',
                color: progettoAttivo?.id === p.id ? '#7DF5DF' : '#666',
                borderColor: progettoAttivo?.id === p.id ? '#1A1A2E' : '#E0E0E0',
              }}>
              {p.nome}
            </button>
          ))}
          <button
            className="flex-shrink-0 px-3 py-2 rounded-lg text-sm border border-dashed border-gray-300 text-gray-400 hover:border-teal-400 hover:text-teal-500 transition-colors">
            + Progetto
          </button>
        </div>
      )}

      {/* Header cliente */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ background: '#1A1A2E' }}>
              {cliente.nome.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{cliente.nome}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <BadgeTipo tipo={cliente.tipo} />
                {isPPL && (
                  <span className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: '#F5F3FF', color: '#6D28D9' }}>
                    PPL
                  </span>
                )}
                <BadgeAlert level={alertLevel}
                  daysLabel={giorni !== null && giorni >= 0 ? `${giorni}gg` : undefined} />
                {progettoAttivo && (
                  <span className="text-xs text-gray-400 italic">{progettoAttivo.nome}</span>
                )}
              </div>
            </div>
          </div>
          {prossimaScadenza && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Prossima scadenza</p>
              <p className="text-sm font-semibold text-gray-900">{formatDate(prossimaScadenza)}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-1">Referente Wave</p>
            {referente && (
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: referente.colore }}>{referente.nome.charAt(0)}</span>
                <span className="text-sm font-medium text-gray-900">{referente.nome}</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Commerciale</p>
            <p className="text-sm font-medium text-gray-900">{commerciale?.nome ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Contatto cliente</p>
            {contatti.filter(c => c.principale).slice(0, 1).map(c => (
              <div key={c.id}>
                <p className="text-sm font-medium text-gray-900">{c.nome}</p>
                <p className="text-xs text-gray-400">{c.ruolo}</p>
              </div>
            ))}
            {contatti.length === 0 && <p className="text-sm text-gray-400">—</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Contratto</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(cliente.scadenza_contratto)}</p>
            {cliente.rinnovo_previsto && (
              <p className="text-xs text-gray-400">Rinnovo: {formatDate(cliente.rinnovo_previsto)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {isPPL ? (
          <>
            <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-2">Lead raccolte / obiettivo</p>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl font-bold text-gray-900">{leadRaccolte}</span>
                <span className="text-gray-400">/</span>
                <span className="text-lg font-medium text-gray-500">{leadObiettivo}</span>
                <span className="ml-auto text-lg font-bold" style={{ color: pctLead >= 80 ? '#1D9E75' : pctLead >= 50 ? '#F9A825' : '#E24B4A' }}>
                  {pctLead}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(pctLead, 100)}%`, background: pctLead >= 80 ? '#1D9E75' : pctLead >= 50 ? '#F9A825' : '#E24B4A' }} />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1">Completamento task</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pctCompletamento}%`, background: '#1D9E75' }} />
                </div>
                <span className="text-sm font-bold text-gray-900">{pctCompletamento}%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{completati}/{totTask} task</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4"
              style={{ borderLeft: taskBloccati > 0 ? '4px solid #E24B4A' : undefined }}>
              <p className="text-xs text-gray-400 mb-1">Bloccati</p>
              <p className="text-2xl font-bold" style={{ color: taskBloccati > 0 ? '#E24B4A' : '#9CA3AF' }}>{taskBloccati}</p>
            </div>
          </>
        ) : (
          <>
            {/* Ore contratto vs allocate */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1">Ore contratto</p>
              <p className="text-2xl font-bold text-gray-900">{oreContratto}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1">Ore allocate</p>
              <p className="text-2xl font-bold text-gray-900">{oreAllocateTotali}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4"
              style={{ borderLeft: oreSaldo < 0 ? '4px solid #E24B4A' : '4px solid #1D9E75' }}>
              <p className="text-xs text-gray-400 mb-1">Saldo ore</p>
              <p className="text-2xl font-bold" style={{ color: oreSaldo < 0 ? '#E24B4A' : '#1D9E75' }}>
                {oreSaldo >= 0 ? `+${oreSaldo}` : oreSaldo}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-2">Task</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pctCompletamento}%`, background: '#1D9E75' }} />
                </div>
                <span className="text-sm font-bold text-gray-900">{pctCompletamento}%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{completati}/{totTask} completati</p>
            </div>
          </>
        )}
      </div>

      {/* Grafici */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Ore per mese</p>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="mese" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="contratto" name="Contratto" fill="#E0E0E0" radius={[2,2,0,0]} />
                <Bar dataKey="allocate" name="Allocate" fill="#7DF5DF" opacity={0.8} radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-gray-400 text-center py-8">Nessun dato</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Ore per risorsa</p>
          {pieDataRisorsa.length > 0 ? (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={90} height={90}>
                <PieChart>
                  <Pie data={pieDataRisorsa} dataKey="value" cx="50%" cy="50%" innerRadius={24} outerRadius={42} paddingAngle={2}>
                    {pieDataRisorsa.map((e, i) => <Cell key={i} fill={e.colore} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}h`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1">
                {pieDataRisorsa.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.colore }} />
                    <span className="text-xs text-gray-700">{d.name}</span>
                    <span className="text-xs font-semibold text-gray-900 ml-auto pl-1">{d.value}h</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-xs text-gray-400 text-center py-8">Nessun dato</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Ore per area</p>
          {pieDataArea.length > 0 ? (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={90} height={90}>
                <PieChart>
                  <Pie data={pieDataArea} dataKey="value" cx="50%" cy="50%" innerRadius={24} outerRadius={42} paddingAngle={2}>
                    {pieDataArea.map((e, i) => <Cell key={i} fill={e.colore} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}h`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1">
                {pieDataArea.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.colore }} />
                    <span className="text-xs text-gray-700">{d.name}</span>
                    <span className="text-xs font-semibold text-gray-900 ml-auto pl-1">{d.value}h</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-xs text-gray-400 text-center py-8">Nessun dato</p>}
        </div>
      </div>

      {/* Tabs contenuto */}
      <div className="flex border-b border-gray-200 mb-5">
        {[
          { id: 'attivita', label: `Attività (${tasks.length})` },
          { id: 'scadenze', label: `Scadenze (${scadenze.length})` },
          { id: 'rinnovo', label: 'Note rinnovo' },
          { id: 'anagrafica', label: 'Anagrafica' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: activeTab === tab.id ? '#3DD4BE' : 'transparent',
              color: activeTab === tab.id ? '#1A1A1A' : '#666',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ATTIVITÀ */}
      {activeTab === 'attivita' && (
        <div>
          {selezione.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3"
              style={{ background: '#FFEBEE', border: '1px solid #FFCDD2' }}>
              <span className="text-sm font-medium text-red-700">{selezione.size} task selezionati</span>
              <button
                onClick={() => { eliminaTask(Array.from(selezione)); setSelezione(new Set()) }}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                style={{ background: '#E24B4A', color: 'white' }}>
                Elimina selezionati
              </button>
              <button onClick={() => setSelezione(new Set())}
                className="text-xs px-2 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors ml-auto">
                Annulla selezione
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {(['aperti', 'tutti'] as const).map(f => (
              <button key={f} onClick={() => setFiltroStato(f)}
                className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
                style={{
                  background: filtroStato === f ? '#1A1A2E' : 'white',
                  color: filtroStato === f ? '#7DF5DF' : '#666',
                  borderColor: filtroStato === f ? '#1A1A2E' : '#E0E0E0',
                }}>
                {f === 'aperti' ? 'Aperti' : 'Tutti'}
              </button>
            ))}
            </div>
            <div className="flex items-center gap-2">
              {tasksFiltrati.length > 0 && (
                <button onClick={() => {
                  if (selezione.size === tasksFiltrati.length) {
                    setSelezione(new Set())
                  } else {
                    setSelezione(new Set(tasksFiltrati.map(t => t.id)))
                  }
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                  {selezione.size === tasksFiltrati.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                </button>
              )}
              <button onClick={() => setShowImport(true)}
                className="text-sm px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
                style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
                ↑ Importa da Excel
              </button>
            </div>
          </div>
          {tasksFiltrati.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Nessun task</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {tasksFiltrati.map((t, i) => {
                const isExp = expandedTask === t.id
                const isLast = i === tasksFiltrati.length - 1
                return (
                  <div key={t.id}
                    style={{ borderBottom: isLast ? 'none' : '1px solid #F0F0F0', background: t.stato === 'bloccato' ? '#FFF8F8' : 'white' }}>
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <input type="checkbox"
                        checked={selezione.has(t.id)}
                        onChange={e => setSelezione(prev => {
                          const next = new Set(prev)
                          e.target.checked ? next.add(t.id) : next.delete(t.id)
                          return next
                        })}
                        className="w-3.5 h-3.5 rounded flex-shrink-0 cursor-pointer accent-teal-500" />
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: getPrio(t.priorita).dot }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900">{t.titolo}</span>
                        <span className="text-xs text-gray-400 ml-2">{t.area}</span>
                        {isExp && (
                          <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
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
                          return p ? (
                            <span key={pid} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ background: p.colore }} title={p.nome}>{p.nome.charAt(0)}</span>
                          ) : null
                        })}
                      </div>
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                        style={{ background: getPrio(t.priorita).bg, color: getPrio(t.priorita).color }}>
                        {getPrio(t.priorita).label}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: getStat(t.stato).bg, color: getStat(t.stato).color }}>
                        {getStat(t.stato).label}
                      </span>
                      <button onClick={() => setExpandedTask(isExp ? null : t.id)}
                        className="text-xs px-1.5 py-0.5 rounded border flex-shrink-0"
                        style={{ borderColor: '#E0E0E0', color: '#999', background: 'white' }}>
                        {isExp ? '▴' : '▾'}
                      </button>
                      <button onClick={() => setActiveTaskModal(tasks.find(raw => raw.id === t.id) ?? null)}
                        className="text-xs px-2 py-0.5 rounded border flex-shrink-0"
                        style={{ borderColor: '#E0E0E0', color: '#999', background: 'white' }}>
                        Modifica
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SCADENZE */}
      {activeTab === 'scadenze' && (
        <div className="space-y-3">
          {scadenze.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Nessuna scadenza</p>
          ) : scadenze.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()).map(s => {
            const days = daysUntil(s.data)
            return (
              <div key={s.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4"
                style={{ borderLeft: s.urgenza === 'critica' ? '4px solid #E53935' : s.urgenza === 'alta' ? '4px solid #F9A825' : '4px solid transparent' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1"><BadgeScadenzaTipo tipo={s.tipo} /></div>
                  <p className="font-semibold text-sm text-gray-900">{s.titolo}</p>
                  {s.note && <p className="text-xs text-gray-400 mt-1 italic">{s.note}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{formatDate(s.data)}</p>
                  {days !== null && (
                    <p className="text-xs" style={{ color: days < 0 ? '#9CA3AF' : days <= 30 ? '#C62828' : '#6B7280' }}>
                      {days < 0 ? `${Math.abs(days)}gg fa` : days === 0 ? 'Oggi' : `tra ${days}gg`}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* NOTE RINNOVO */}
      {activeTab === 'rinnovo' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Note strategiche</p>
            <button onClick={() => setNotaEdit(notaEdit !== null ? null : (noteRinnovoText ?? ''))}
              className="text-xs px-2 py-1 rounded border transition-colors"
              style={{ borderColor: notaEdit !== null ? '#3DD4BE' : '#E0E0E0', color: notaEdit !== null ? '#3DD4BE' : '#999' }}>
              {notaEdit !== null ? 'Annulla' : 'Modifica'}
            </button>
          </div>
          {notaEdit !== null ? (
            <div>
              <textarea value={notaEdit} onChange={e => setNotaEdit(e.target.value)}
                className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg p-3 outline-none resize-none"
                style={{ minHeight: 120, lineHeight: 1.6 }} />
              <button onClick={() => { updateNoteRinnovo(clienteId, notaEdit ?? ''); setNotaEdit(null) }}
                className="mt-3 text-sm px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
                Salva nota
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-800 leading-relaxed">
              {noteRinnovoText ?? 'Nessuna nota ancora inserita.'}
            </p>
          )}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Scadenza rinnovo</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(cliente.rinnovo_previsto)}
              {giorni !== null && giorni >= 0 && <span className="ml-2 text-xs font-normal text-gray-400">tra {giorni} giorni</span>}
            </p>
          </div>
        </div>
      )}

      {/* ANAGRAFICA */}
      {activeTab === 'anagrafica' && (
        <div className="space-y-5">

          {/* Dati cliente */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Dati cliente</p>
              <button onClick={() => setAnagraficaEdit(!anagraficaEdit)}
                className="text-xs px-2 py-1 rounded border transition-colors"
                style={{ borderColor: anagraficaEdit ? '#3DD4BE' : '#E0E0E0', color: anagraficaEdit ? '#3DD4BE' : '#999' }}>
                {anagraficaEdit ? 'Chiudi' : 'Modifica'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Nome cliente', value: cliente.nome },
                { label: 'Referente Wave', value: referente?.nome ?? '—' },
                { label: 'Commerciale', value: commerciale?.nome ?? '—' },
                { label: 'Tipo contratto', value: isPPL ? 'PPL' : 'Progetto' },
              ].map(field => (
                <div key={field.label}>
                  <p className="text-xs text-gray-400 mb-1">{field.label}</p>
                  {anagraficaEdit ? (
                    <input defaultValue={field.value}
                      className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 bg-white outline-none focus:border-teal-400" />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{field.value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Contratto */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Contratto</p>
              <button onClick={() => setContrattoEdit(!contrattoEdit)}
                className="text-xs px-2 py-1 rounded border transition-colors"
                style={{ borderColor: contrattoEdit ? '#3DD4BE' : '#E0E0E0', color: contrattoEdit ? '#3DD4BE' : '#999' }}>
                {contrattoEdit ? 'Annulla' : 'Modifica'}
              </button>
            </div>
            {contrattoEdit ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Scadenza contratto</label>
                    <input type="date" value={contrattoForm.scadenza}
                      onChange={e => setContrattoForm(f => ({ ...f, scadenza: e.target.value }))}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Rinnovo previsto</label>
                    <input type="date" value={contrattoForm.rinnovo}
                      onChange={e => setContrattoForm(f => ({ ...f, rinnovo: e.target.value }))}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
                  </div>
                </div>
                {isPPL && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Lead obiettivo</label>
                      <input type="number" value={contrattoForm.lead_obiettivo}
                        onChange={e => setContrattoForm(f => ({ ...f, lead_obiettivo: e.target.value }))}
                        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Lead raccolte</label>
                      <input type="number" value={contrattoForm.lead_raccolte}
                        onChange={e => setContrattoForm(f => ({ ...f, lead_raccolte: e.target.value }))}
                        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <button onClick={handleSalvaContratto}
                    className="text-sm px-4 py-2 rounded-lg font-medium"
                    style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
                    Salva contratto
                  </button>
                  <p className="text-xs text-gray-400">Le modifiche vengono salvate su database</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Scadenza contratto</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(cliente.scadenza_contratto) || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Rinnovo previsto</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(cliente.rinnovo_previsto) || '—'}</p>
                </div>
                {isPPL && (
                  <>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Lead obiettivo</p>
                      <p className="text-sm font-medium text-gray-900">{cliente.lead_obiettivo ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Lead raccolte</p>
                      <p className="text-sm font-medium text-gray-900">{cliente.lead_raccolte ?? '—'}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Progetti */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Progetti ({progetti.length})</p>
              <button onClick={() => setShowNuovoProgetto(true)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
                + Nuovo progetto
              </button>
            </div>
            {progetti.length === 0 ? (
              <p className="text-sm text-gray-400">Nessun progetto. Creane uno per iniziare a tracciare ore e task.</p>
            ) : (
              <div className="space-y-2">
                {progetti.map(p => (
                  <div key={p.id} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100"
                    style={{ background: progettoAttivo?.id === p.id ? '#F0FDFB' : '#FAFAFA' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{p.nome}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">{p.anno}</span>
                        <span className="text-xs text-gray-400">{p.ore_contratto}h contratto</span>
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: p.stato === 'attivo' ? '#EAF3DE' : '#F3F4F6', color: p.stato === 'attivo' ? '#27500A' : '#666' }}>
                          {p.stato}
                        </span>
                      </div>
                      {p.data_inizio && p.data_fine && (
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.data_inizio)} → {formatDate(p.data_fine)}</p>
                      )}
                    </div>
                    <button onClick={() => { setProgettoSelezionato(p.id); setActiveTab('attivita') }}
                      className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0">
                      Vai →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contatti */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Contatti</p>
            {contatti.length === 0 ? (
              <p className="text-sm text-gray-400">Nessun contatto inserito.</p>
            ) : contatti.map(c => (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg mb-2 last:mb-0"
                style={{ background: c.principale ? '#F0FDFB' : '#F8F9FA' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{c.nome}</span>
                    {c.principale && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#E0FDF8', color: '#0D9488' }}>Principale</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{c.ruolo}</p>
                  <div className="flex gap-3 mt-1">
                    {c.email && <a href={`mailto:${c.email}`} className="text-xs text-blue-500 hover:underline">{c.email}</a>}
                    {c.telefono && <span className="text-xs text-gray-500">{c.telefono}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  )
}

// ── Form nuovo progetto ───────────────────────────────────────────────────

function NuovoProgettoForm({ clienteId, clienteNome, onClose }: {
  clienteId: string
  clienteNome: string
  onClose: () => void
}) {
  const [form, setForm] = useState({
    nome: `${clienteNome} ${new Date().getFullYear()}`,
    anno: new Date().getFullYear(),
    ore_contratto: '',
    data_inizio: '',
    data_fine: '',
    stato: 'attivo' as 'attivo' | 'concluso' | 'sospeso',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSalva() {
    if (!form.nome.trim()) { setError('Nome obbligatorio'); return }
    setSaving(true)
    const id = `proj_${clienteId}_${Date.now()}`
    const progetto = {
      id,
      cliente: clienteId,
      nome: form.nome.trim(),
      anno: form.anno,
      ore_contratto: Number(form.ore_contratto) || 0,
      stato: form.stato,
      data_inizio: form.data_inizio || null,
      data_fine: form.data_fine || null,
    }
    try {
      await sbPost('progetti', progetto)
      setSaving(false)
      onClose()
      // Ricarica la pagina per vedere il nuovo progetto
      window.location.reload()
    } catch(e: any) {
      setError('Errore salvataggio: ' + e.message)
      setSaving(false)
    }
  }

  return (
    <div className="px-6 py-5 space-y-4">
      {error && <p className="text-xs text-red-600 px-3 py-2 rounded-lg" style={{ background: '#FFEBEE' }}>{error}</p>}

      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">Nome progetto *</label>
        <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Anno</label>
          <input type="number" value={form.anno} onChange={e => setForm(f => ({ ...f, anno: Number(e.target.value) }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Ore contratto</label>
          <input type="number" value={form.ore_contratto} onChange={e => setForm(f => ({ ...f, ore_contratto: e.target.value }))}
            placeholder="es. 120"
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Data inizio</label>
          <input type="date" value={form.data_inizio} onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Data fine</label>
          <input type="date" value={form.data_fine} onChange={e => setForm(f => ({ ...f, data_fine: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
          Annulla
        </button>
        <button onClick={handleSalva} disabled={saving}
          className="text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
          {saving ? 'Salvataggio...' : 'Crea progetto'}
        </button>
      </div>
    </div>
  )
}
