import React, { useState, useMemo, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { Seed, Persona, Task, TaskStato, TaskPriorita, Contatto, Progetto } from '../types'
import { formatDate, daysUntil, getAlertLevel, getProssimaScadenza } from '../utils'
import { BadgeTipo, BadgeAlert, BadgeScadenzaTipo } from '../components/UI'
import { useTaskContext } from '../context/TaskContext'
import { useClienteContext } from '../context/ClienteContext'
import { sbPatch, sbPost, sbUpsert, sbDelete } from '../lib/supabase'
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
  const [activeTab, setActiveTab] = useState<'anagrafica' | 'attivita' | 'scadenze' | 'costi' | 'rinnovo' | 'archivio'>('anagrafica')
  const [filtroStato, setFiltroStato] = useState<'aperti' | 'tutti'>('aperti')
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [activeTaskModal, setActiveTaskModal] = useState<Task | null>(null)
  const [notaEdit, setNotaEdit] = useState<string | null>(null)
  const [anagraficaEdit, setAnagraficaEdit] = useState(false)
  const [anagraficaFields, setAnagraficaFields] = useState<Record<string,any>>({})
  const [contrattoEdit, setContrattoEdit] = useState(false)
  const [showNuovoProgetto, setShowNuovoProgetto] = useState(false)
  const [progettoInModifica, setProgettoInModifica] = useState<string | null>(null)
  const [showProgettiArchiviati, setShowProgettiArchiviati] = useState(false)
  const [progettiLocali, setProgettiLocali] = useState<any[]>([])
  const [progettiOverride, setProgettiOverride] = useState<Record<string, any>>({})
  const [showNuovaScadenza, setShowNuovaScadenza] = useState(false)
  const [showNuovoTask, setShowNuovoTask] = useState(false)
  const [scadenzeLocali, setScadenzeLocali] = useState<any[]>([])
  const [showNuovoContatto, setShowNuovoContatto] = useState(false)
  const [contattoInModifica, setContattoInModifica] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [contrattoForm, setContrattoForm] = useState({
    scadenza: '',
    rinnovo: '',
    lead_obiettivo: '',
    lead_raccolte: '',
  })
  const [taskImportati, setTaskImportati] = useState<any[]>([])
  const [selezione, setSelezione] = useState<Set<string>>(new Set())

  const { getTask, updateTask, eliminaTask, isEliminato, addTask } = useTaskContext()

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
  const { getCliente, getContatti, updateCliente, updateContatti, updateNoteRinnovo, getNoteRinnovo } = useClienteContext()

  const clienteBase = seed.clienti.find(c => c.id === clienteId)
  const cliente = clienteBase ? getCliente(clienteBase) : undefined

  const personaById = useMemo(() => {
    const m: Record<string, Persona> = {}
    seed.team.forEach(p => { m[p.id] = p })
    return m
  }, [seed.team])

  // Progetti del cliente
  const progetti = useMemo(() => {
    const fromSeed = (seed.progetti ?? []).filter(p => p.cliente === clienteId)
      .map(p => progettiOverride[p.id] ? { ...p, ...progettiOverride[p.id] } : p)
    const fromLocal = progettiLocali.filter(p => p.cliente === clienteId)
      .map(p => progettiOverride[p.id] ? { ...p, ...progettiOverride[p.id] } : p)
    return [...fromSeed, ...fromLocal].filter((p: any) => !p._deleted)
  }, [seed.progetti, clienteId, progettiLocali, progettiOverride])

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

  if (!cliente) return <div className="p-8 text-gray-500">Cliente non trovato</div>

  const referente = personaById[cliente.referente]
  const commerciale = personaById[cliente.commerciale]
  const alertLevel = getAlertLevel(cliente)
  const prossimaScadenza = getProssimaScadenza(cliente)
  const giorni = daysUntil(prossimaScadenza)

  // Ore: contratto vs allocate (somma ore stimate dei task) vs effettive
  const oreContratto = progettoAttivo?.ore_contratto ?? 0
  const oreAllocateTotali = Math.round(tasksConEdits.reduce((s, t) => s + (t.ore_stimate || 0), 0))

  // Dati grafico a barre mensile
  const mesiLabel = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
  const annoCorrente = new Date().getFullYear()
  // Ore effettive per mese (da Supabase via timesheet) — array Gen-Dic
  const oreEffettiveMesi: number[] = (() => {
    const raw = (cliente as any).ore_effettive_mesi_2026
    if (Array.isArray(raw) && raw.length > 0) return raw.map(Number)
    return new Array(12).fill(0)
  })()
  const barData = mesiLabel.map((mese, mi) => {
    const effettive = oreEffettiveMesi[mi] ?? 0
    const pianificate = Math.round(oreContratto / 12)
    return { mese, effettive, pianificate }
  }).filter(d => d.effettive > 0 || d.pianificate > 0)

  // Torte ore per risorsa e per area — caricate da OreEffettiveTorte (dettaglio timesheet)

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
              onSaved={(p) => {
                setProgettiLocali(prev => [...prev, p])
                setProgettoSelezionato(p.id)
                setActiveTab('attivita')
              }}
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
          onImport={async (nuoviTask) => {
            const saved: any[] = []
            for (const t of nuoviTask) {
              const id = await addTask(t)
              saved.push({ ...t, id })
            }
            setTaskImportati(prev => [...prev, ...saved])
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
            <p className="text-xs text-gray-400 mb-1">Scadenza progetto</p>
            <p className="text-sm font-medium text-gray-900">
              {progettoAttivo?.data_fine ? formatDate(progettoAttivo.data_fine) : '—'}
            </p>
            {(() => {
              const fine = progettoAttivo?.data_fine ? new Date(progettoAttivo.data_fine) : null
              const rinnovoRaw = (progettoAttivo as any)?.rinnovo_previsto
              const rinnovo = rinnovoRaw ? new Date(rinnovoRaw) : (fine ? new Date(fine.getTime() - 30*24*60*60*1000) : null)
              if (!rinnovo) return null
              return <p className="text-xs text-gray-400">Rinnovo: {formatDate(rinnovo.toISOString().slice(0,10))}{!rinnovoRaw && ' (stimato)'}</p>
            })()}
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
            {/* Ore lavorabili / allocate / effettive / saldo */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1">Ore lavorabili</p>
              <p className="text-2xl font-bold text-gray-900">{oreContratto}</p>
              <p className="text-xs text-gray-400 mt-1">da contratto</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1">Ore allocate</p>
              <p className="text-2xl font-bold text-gray-900">{oreAllocateTotali}</p>
              <p className="text-xs text-gray-400 mt-1">somma task</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1">Ore effettive</p>
              <p className="text-2xl font-bold text-gray-900">{Math.round((cliente as any).ore_effettive_ytd_2026 ?? 0)}</p>
              <p className="text-xs text-gray-400 mt-1">dal timesheet</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4"
              style={{ borderLeft: oreAllocateTotali < Math.round((cliente as any).ore_effettive_ytd_2026 ?? 0) ? '4px solid #E24B4A' : '4px solid #1D9E75' }}>
              <p className="text-xs text-gray-400 mb-1">Saldo</p>
              {(() => {
                if (oreAllocateTotali === 0) return (
                  <><p className="text-2xl font-bold text-gray-300">—</p>
                  <p className="text-xs text-gray-400 mt-1">inserisci task</p></>
                )
                const saldo = oreAllocateTotali - Math.round((cliente as any).ore_effettive_ytd_2026 ?? 0)
                return <>
                  <p className="text-2xl font-bold" style={{ color: saldo < 0 ? '#E24B4A' : '#1D9E75' }}>
                    {saldo >= 0 ? `+${saldo}` : saldo}h
                  </p>
                  <p className="text-xs text-gray-400 mt-1">allocate - effettive</p>
                </>
              })()}
            </div>
            {(progettoAttivo as any)?.importo_contratto > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-400 mb-1">Importo contratto</p>
                <p className="text-2xl font-bold text-gray-900">€{((progettoAttivo as any).importo_contratto ?? 0).toLocaleString('it-IT')}</p>
                <p className="text-xs text-gray-400 mt-1">valore progetto</p>
              </div>
            )}
            <CostiEsterniTotale progettoAttivoId={progettoAttivo?.id ?? null} />
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
                <Bar dataKey="pianificate" name="Pianificate" fill="#E0E0E0" radius={[2,2,0,0]} />
                <Bar dataKey="effettive" name="Effettive" fill="#7DF5DF" opacity={0.8} radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-gray-400 text-center py-8">Nessun dato</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Ore per risorsa</p>
          <OreEffettiveTorta clienteId={clienteId} tipo="risorsa" team={seed.team} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Ore per area</p>
          <OreEffettiveTorta clienteId={clienteId} tipo="area" team={seed.team} />
        </div>
      </div>

      {/* Tabs contenuto */}
      <div className="flex border-b border-gray-200 mb-5">
        {[
          { id: 'anagrafica', label: 'Anagrafica' },
          { id: 'attivita', label: `Attività (${tasks.length})` },
          { id: 'scadenze', label: `Scadenze (${scadenze.length})` },
          { id: 'costi', label: 'Costi esterni' },
          { id: 'rinnovo', label: 'Note rinnovo' },
          { id: 'archivio', label: `Archivio (${progetti.filter(p => p.stato === 'concluso').length})` },
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
              <button onClick={() => setShowNuovoTask(true)}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                + Task
              </button>
              <button onClick={() => setShowImport(true)}
                className="text-sm px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
                style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
                ↑ Importa da Excel
              </button>
            </div>
          </div>
          {showNuovoTask && (
            <NuovoTaskForm
              clienteId={clienteId}
              progettoAttivoId={progettoAttivo?.id ?? null}
              progetti={progetti}
              personaById={personaById}
              onClose={() => setShowNuovoTask(false)}
              onSaved={(t) => { setTaskImportati(prev => [...prev, t]); setShowNuovoTask(false) }}
            />
          )}
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

          {/* Timeline progetto attivo */}
          {progettoAttivo && (progettoAttivo.data_inizio || progettoAttivo.data_fine) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">
                Periodo progetto — {progettoAttivo.nome}
              </p>
              {(() => {
                const inizio = progettoAttivo.data_inizio ? new Date(progettoAttivo.data_inizio) : null
                const fine = progettoAttivo.data_fine ? new Date(progettoAttivo.data_fine) : null
                const rinnovoRaw = (progettoAttivo as any).rinnovo_previsto
                // Se rinnovo non inserito, calcolo automaticamente 1 mese prima della scadenza
                const rinnovo = rinnovoRaw
                  ? new Date(rinnovoRaw)
                  : (fine ? new Date(fine.getTime() - 30*24*60*60*1000) : null)
                const rinnovoAutomatico = !rinnovoRaw && !!fine

                if (!inizio || !fine) return (
                  <p className="text-xs text-gray-400">Date progetto incomplete — inserisci data inizio e fine in Anagrafica.</p>
                )

                const oggi = new Date()
                const totMs = fine.getTime() - inizio.getTime()
                const passedMs = Math.min(Math.max(oggi.getTime() - inizio.getTime(), 0), totMs)
                const pct = totMs > 0 ? (passedMs / totMs) * 100 : 0
                const rinnovoPct = rinnovo && totMs > 0 ? Math.min(Math.max(((rinnovo.getTime() - inizio.getTime()) / totMs) * 100, 0), 100) : null

                return (
                  <div>
                    <div className="relative h-8 rounded-lg overflow-hidden" style={{ background: '#F1EFE8' }}>
                      <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${pct}%`, background: '#7DF5DF' }} />
                      {rinnovoPct !== null && (
                        <div className="absolute inset-y-0 w-0.5" style={{ left: `${rinnovoPct}%`, background: '#F9A825' }} />
                      )}
                      <div className="absolute inset-y-0 right-0 w-0.5" style={{ background: '#E53935' }} />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                      <span>{formatDate(progettoAttivo.data_inizio!)}</span>
                      <span className="font-medium" style={{ color: '#1A1A2E' }}>{Math.round(pct)}% trascorso</span>
                      <span>{formatDate(progettoAttivo.data_fine!)}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#E53935' }} />
                        <span className="text-xs text-gray-600">Scadenza contratto: <strong>{formatDate(progettoAttivo.data_fine!)}</strong></span>
                      </div>
                      {rinnovo && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#F9A825' }} />
                          <span className="text-xs text-gray-600">
                            Rinnovo previsto: <strong>{formatDate(rinnovo.toISOString().slice(0,10))}</strong>
                            {rinnovoAutomatico && <span className="text-gray-400 italic"> (stimato, -30gg)</span>}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">{scadenze.length + scadenzeLocali.length} scadenze</span>
            <button onClick={() => setShowNuovaScadenza(!showNuovaScadenza)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
              {showNuovaScadenza ? 'Annulla' : '+ Nuova scadenza'}
            </button>
          </div>

          {showNuovaScadenza && (
            <NuovaScadenzaForm
              clienteId={clienteId}
              progetti={progetti}
              progettoAttivoId={progettoAttivo?.id ?? null}
              referentiTeam={seed.team}
              onClose={() => setShowNuovaScadenza(false)}
              onSaved={(s) => { setScadenzeLocali(prev => [...prev, s]); setShowNuovaScadenza(false) }}
            />
          )}

          {[...scadenze, ...scadenzeLocali].length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Nessuna scadenza. Aggiungine una.</p>
          ) : [...scadenze, ...scadenzeLocali].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()).map(s => {
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
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{formatDate(s.data)}</p>
                    {days !== null && (
                      <p className="text-xs" style={{ color: days < 0 ? '#9CA3AF' : days <= 30 ? '#C62828' : '#6B7280' }}>
                        {days < 0 ? `${Math.abs(days)}gg fa` : days === 0 ? 'Oggi' : `tra ${days}gg`}
                      </p>
                    )}
                  </div>
                  <button onClick={async () => {
                    try { await sbPatch('scadenze', s.id, { stato: 'chiuso' }) } catch(e) {}
                    setScadenzeLocali(prev => prev.filter(x => x.id !== s.id))
                  }}
                    className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    Chiudi
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {/* COSTI ESTERNI */}
      {activeTab === 'costi' && (
        <CostiEsterniTab
          clienteId={clienteId}
          progettoAttivoId={progettoAttivo?.id ?? null}
          progettoNome={progettoAttivo?.nome ?? 'Nessun progetto'}
        />
      )}

      {/* ARCHIVIO */}
      {activeTab === 'archivio' && (
        <div className="space-y-3">
          {progetti.filter(p => p.stato === 'concluso').length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">Nessun progetto concluso.</p>
              <p className="text-xs text-gray-300 mt-1">I progetti conclusi appariranno qui.</p>
            </div>
          ) : (
            progetti.filter(p => p.stato === 'concluso').map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-700">{p.nome}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>concluso</span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-400">{p.anno}</span>
                        {p.data_inizio && p.data_fine && (
                          <span className="text-xs text-gray-400">{formatDate(p.data_inizio)} → {formatDate(p.data_fine)}</span>
                        )}
                        <span className="text-xs text-gray-500 font-medium">{p.ore_contratto}h lavorabili</span>
                        {(p.importo_contratto ?? 0) > 0 && (
                          <span className="text-xs font-semibold text-gray-700">€{(p.importo_contratto ?? 0).toLocaleString('it-IT')}</span>
                        )}
                      </div>
                      {p.note_commerciali && (
                        <p className="text-xs text-gray-400 italic mt-1">{p.note_commerciali}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setProgettoInModifica(progettoInModifica === p.id ? null : p.id)}
                        className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100">
                        {progettoInModifica === p.id ? 'Chiudi' : 'Modifica'}
                      </button>
                      <button onClick={async () => {
                          if (!confirm(`Eliminare definitivamente il progetto "${p.nome}"?`)) return
                          try { await sbDelete('progetti', p.id) } catch(e) { console.error(e) }
                          setProgettiOverride(prev => ({ ...prev, [p.id]: { ...p, _deleted: true } }))
                        }}
                        className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
                        Elimina
                      </button>
                    </div>
                  </div>
                </div>
                {progettoInModifica === p.id && (
                  <div className="border-t border-gray-100">
                    <ModificaProgettoForm
                      progetto={p}
                      onClose={() => setProgettoInModifica(null)}
                      onSaved={(updated) => {
                        setProgettiLocali(prev => prev.map(x => x.id === updated.id ? updated : x))
                        setProgettiOverride(prev => ({ ...prev, [updated.id]: updated }))
                        setProgettoInModifica(null)
                      }}
                    />
                  </div>
                )}
              </div>
            ))
          )}
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
              <button onClick={async () => {
                const nota = notaEdit ?? ''
                updateNoteRinnovo(clienteId, nota)
                setNotaEdit(null)
                try {
                  await sbUpsert('note_rinnovo', { id: `note_${clienteId}`, cliente: clienteId, note: nota })
                } catch(e) { console.error('Salva nota:', e) }
              }}
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
            {(() => {
              const fine = progettoAttivo?.data_fine ? new Date(progettoAttivo.data_fine) : null
              const rinnovoRaw = (progettoAttivo as any)?.rinnovo_previsto
              const rinnovo = rinnovoRaw ? new Date(rinnovoRaw) : (fine ? new Date(fine.getTime() - 30*24*60*60*1000) : null)
              if (!rinnovo) return <p className="text-sm text-gray-400">— (inserisci date progetto in Anagrafica)</p>
              const g = daysUntil(rinnovo.toISOString().slice(0,10))
              return (
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(rinnovo.toISOString().slice(0,10))}
                  {!rinnovoRaw && <span className="text-xs text-gray-400 italic"> (stimato)</span>}
                  {g !== null && g >= 0 && <span className="ml-2 text-xs font-normal text-gray-400">tra {g} giorni</span>}
                </p>
              )
            })()}
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
                {anagraficaEdit ? 'Annulla' : 'Modifica'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Nome cliente</p>
                {anagraficaEdit
                  ? <input value={anagraficaFields.nome ?? cliente.nome}
                      onChange={e => setAnagraficaFields(f => ({ ...f, nome: e.target.value }))}
                      className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 bg-white outline-none focus:border-teal-400" />
                  : <p className="text-sm font-medium text-gray-900">{cliente.nome}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Referente Wave</p>
                {anagraficaEdit
                  ? <select value={anagraficaFields.referente ?? cliente.referente ?? ''}
                      onChange={e => setAnagraficaFields(f => ({ ...f, referente: e.target.value }))}
                      className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 bg-white outline-none">
                      {seed.team.filter((p: any) => p.tipo === 'operativo').map((p: any) => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  : <p className="text-sm font-medium text-gray-900">{referente?.nome ?? '—'}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Commerciale</p>
                {anagraficaEdit
                  ? <select value={anagraficaFields.commerciale ?? cliente.commerciale ?? ''}
                      onChange={e => setAnagraficaFields(f => ({ ...f, commerciale: e.target.value }))}
                      className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 bg-white outline-none">
                      {seed.team.filter((p: any) => p.tipo === 'commerciale').map((p: any) => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  : <p className="text-sm font-medium text-gray-900">{commerciale?.nome ?? '—'}</p>}
              </div>

            </div>
            {anagraficaEdit && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                <button onClick={async () => {
                  if (Object.keys(anagraficaFields).length === 0) { setAnagraficaEdit(false); return }
                  try {
                    await sbPatch('clienti', clienteId, anagraficaFields)
                    updateCliente(clienteId, anagraficaFields)
                  } catch(e) {
                    updateCliente(clienteId, anagraficaFields)
                  }
                  setAnagraficaFields({})
                  setAnagraficaEdit(false)
                }}
                  className="text-sm px-4 py-2 rounded-lg font-medium"
                  style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
                  Salva modifiche
                </button>
                <p className="text-xs text-gray-400">Salvato su database</p>
              </div>
            )}
          </div>

          {/* Lead PPL — solo per clienti PPL */}
          {isPPL && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Lead PPL</p>
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
                  <button onClick={handleSalvaContratto}
                    className="text-sm px-4 py-2 rounded-lg font-medium"
                    style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
                    Salva
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Lead obiettivo</p>
                    <p className="text-sm font-medium text-gray-900">{cliente.lead_obiettivo ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Lead raccolte</p>
                    <p className="text-sm font-medium text-gray-900">{cliente.lead_raccolte ?? '—'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

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
                {/* Progetti attivi */}
                {progetti.filter(p => p.stato === 'attivo' || p.stato === 'sospeso').map(p => (
                  <div key={p.id} className="rounded-lg border border-gray-200 overflow-hidden"
                    style={{ background: progettoAttivo?.id === p.id ? '#F0FDFB' : 'white' }}>
                    <div className="flex items-center gap-4 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{p.nome}</p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-400">{p.anno}</span>
                          <span className="text-xs text-gray-400">{p.ore_contratto}h lavorabili</span>
                          <span className="text-xs font-medium" style={{ color: (p.importo_contratto ?? 0) > 0 ? '#1A1A2E' : '#D1D5DB' }}>
                            {(p.importo_contratto ?? 0) > 0 ? `€${(p.importo_contratto ?? 0).toLocaleString('it-IT')}` : 'Importo non inserito'}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: p.stato === 'attivo' ? '#EAF3DE' : '#FFF3E0', color: p.stato === 'attivo' ? '#27500A' : '#E65100' }}>
                            {p.stato}
                          </span>
                        </div>
                        {p.data_inizio && p.data_fine && (
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.data_inizio)} → {formatDate(p.data_fine)}</p>
                        )}
                        {p.note_commerciali && (
                          <p className="text-xs text-gray-400 italic mt-1">{p.note_commerciali}</p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => setProgettoInModifica(progettoInModifica === p.id ? null : p.id)}
                          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                          Modifica
                        </button>
                        <button onClick={() => { setProgettoSelezionato(p.id); setActiveTab('attivita') }}
                          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                          Vai →
                        </button>
                        <button onClick={async () => {
                            if (!confirm(`Eliminare il progetto "${p.nome}"? Task e dati collegati non verranno eliminati automaticamente.`)) return
                            try { await sbDelete('progetti', p.id) } catch(e) { console.error(e) }
                            setProgettiLocali(prev => prev.filter(x => x.id !== p.id))
                            setProgettiOverride(prev => {
                              const next = { ...prev }
                              delete next[p.id]
                              return next
                            })
                            // Se era nel seed, lo segno come "eliminato" via override con flag
                            setProgettiOverride(prev => ({ ...prev, [p.id]: { ...p, _deleted: true } }))
                          }}
                          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          Elimina
                        </button>
                      </div>
                    </div>
                    {progettoInModifica === p.id && (
                      <div className="border-t border-gray-100">
                        <ModificaProgettoForm
                          progetto={p}
                          onClose={() => setProgettoInModifica(null)}
                          onSaved={(updated) => {
                            setProgettiLocali(prev => prev.map(x => x.id === updated.id ? updated : x))
                            setProgettiOverride(prev => ({ ...prev, [updated.id]: updated }))
                            setProgettoInModifica(null)
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Progetti conclusi — collassati */}
                {progetti.filter(p => p.stato === 'concluso').length > 0 && (
                  <div className="mt-3">
                    <button onClick={() => setShowProgettiArchiviati(!showProgettiArchiviati)}
                      className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-2">
                      <span>{showProgettiArchiviati ? '▾' : '▸'}</span>
                      Archiviati ({progetti.filter(p => p.stato === 'concluso').length})
                    </button>
                    {showProgettiArchiviati && progetti.filter(p => p.stato === 'concluso').map(p => (
                      <div key={p.id} className="rounded-lg border border-gray-100 p-3 mb-2 opacity-70">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">{p.nome}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-gray-400">{p.anno}</span>
                              <span className="text-xs text-gray-400">{p.ore_contratto}h</span>
                              {(p.importo_contratto ?? 0) > 0 && <span className="text-xs text-gray-400">€{(p.importo_contratto ?? 0).toLocaleString('it-IT')}</span>}
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>concluso</span>
                            </div>
                            {p.data_inizio && p.data_fine && (
                              <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.data_inizio)} → {formatDate(p.data_fine)}</p>
                            )}
                          </div>
                          <button onClick={() => setProgettoInModifica(progettoInModifica === p.id ? null : p.id)}
                            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:bg-gray-100">
                            Dettaglio
                          </button>
                        </div>
                        {progettoInModifica === p.id && (
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <ModificaProgettoForm
                              progetto={p}
                              onClose={() => setProgettoInModifica(null)}
                              onSaved={(updated) => {
                                setProgettiLocali(prev => prev.map(x => x.id === updated.id ? updated : x))
                                setProgettoInModifica(null)
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contatti */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Contatti</p>
              <button onClick={() => setShowNuovoContatto(true)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
                + Aggiungi contatto
              </button>
            </div>
            {contatti.length === 0 ? (
              <p className="text-sm text-gray-400">Nessun contatto inserito.</p>
            ) : contatti.map(c => (
              <div key={c.id} className="rounded-lg mb-2 last:mb-0 overflow-hidden"
                style={{ background: c.principale ? '#F0FDFB' : '#F8F9FA' }}>
                <div className="flex items-start gap-3 p-3">
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
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => setContattoInModifica(contattoInModifica === c.id ? null : c.id)}
                      className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:bg-gray-100 transition-colors">
                      {contattoInModifica === c.id ? 'Chiudi' : 'Modifica'}
                    </button>
                    <button onClick={async () => {
                        if (!confirm(`Eliminare il contatto ${c.nome}?`)) return
                        try { await sbDelete('contatti', c.id) } catch(e) { console.error(e) }
                        updateContatti(clienteId, contatti.filter(x => x.id !== c.id))
                      }}
                      className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      Elimina
                    </button>
                  </div>
                </div>
                {contattoInModifica === c.id && (
                  <div className="border-t border-gray-200 bg-white">
                    <ModificaContattoForm
                      contatto={c}
                      onClose={() => setContattoInModifica(null)}
                      onSaved={(updated) => {
                        updateContatti(clienteId, contatti.map(x => x.id === updated.id ? updated : x))
                        setContattoInModifica(null)
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
            {showNuovoContatto && (
              <NuovoContattoForm
                clienteId={clienteId}
                onClose={() => setShowNuovoContatto(false)}
                onSaved={(c) => { updateContatti(clienteId, [...contatti, c]); setShowNuovoContatto(false) }}
              />
            )}
          </div>

        </div>
      )}
    </div>
  )
}

// ── Form nuovo progetto ───────────────────────────────────────────────────

function NuovoProgettoForm({ clienteId, clienteNome, onClose, onSaved }: {
  clienteId: string
  clienteNome: string
  onClose: () => void
  onSaved?: (progetto: any) => void
}) {
  const [form, setForm] = useState({
    nome: `${clienteNome} ${new Date().getFullYear()}`,
    anno: new Date().getFullYear(),
    ore_contratto: '',
    importo_contratto: '',
    data_inizio: '',
    data_fine: '',
    rinnovo_previsto: '',
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
      importo_contratto: Number(form.importo_contratto) || 0,
      stato: form.stato,
      data_inizio: form.data_inizio || null,
      data_fine: form.data_fine || null,
      rinnovo_previsto: form.rinnovo_previsto || null,
    }
    try {
      await sbPost('progetti', progetto)
      setSaving(false)
      onSaved?.(progetto)
      onClose()
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
          <label className="text-xs text-gray-500 font-medium block mb-1">Ore lavorabili</label>
          <input type="number" value={form.ore_contratto} onChange={e => setForm(f => ({ ...f, ore_contratto: e.target.value }))}
            placeholder="es. 120"
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Importo contratto (€)</label>
          <input type="number" value={form.importo_contratto} onChange={e => setForm(f => ({ ...f, importo_contratto: e.target.value }))}
            placeholder="es. 8400"
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Data inizio</label>
          <input type="date" value={form.data_inizio} onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Data fine / scadenza</label>
          <input type="date" value={form.data_fine} onChange={e => setForm(f => ({ ...f, data_fine: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Rinnovo previsto</label>
          <input type="date" value={form.rinnovo_previsto} onChange={e => setForm(f => ({ ...f, rinnovo_previsto: e.target.value }))}
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

// ── Form nuova scadenza ───────────────────────────────────────────────────

function NuovaScadenzaForm({ clienteId, progetti, progettoAttivoId, referentiTeam, onClose, onSaved }: {
  clienteId: string
  progetti: any[]
  progettoAttivoId: string | null
  referentiTeam: any[]
  onClose: () => void
  onSaved: (s: any) => void
}) {
  const [form, setForm] = useState({
    titolo: '',
    tipo: 'rinnovo' as 'rinnovo' | 'rilascio' | 'riunione_cliente' | 'interno' | 'checkpoint',
    urgenza: 'normale' as 'critica' | 'alta' | 'normale',
    data: '',
    progetto_id: progettoAttivoId ?? '',
    referente: referentiTeam.find(p => p.tipo === 'operativo')?.id ?? '',
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSalva() {
    if (!form.titolo.trim()) { setError('Titolo obbligatorio'); return }
    if (!form.data) { setError('Data obbligatoria'); return }
    setSaving(true)
    const scadenza = {
      id: `scad_${clienteId}_${Date.now()}`,
      cliente: clienteId,
      progetto_id: form.progetto_id || null,
      titolo: form.titolo.trim(),
      tipo: form.tipo,
      urgenza: form.urgenza,
      data: form.data,
      stato: 'aperto',
      referente: form.referente || null,
      note: form.note.trim() || null,
    }
    try {
      await sbPost('scadenze', scadenza)
    } catch(e) {
      console.error('Salva scadenza:', e)
    }
    setSaving(false)
    onSaved(scadenza)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Nuova scadenza</p>
      {error && <p className="text-xs text-red-600 px-3 py-2 rounded-lg" style={{ background: '#FFEBEE' }}>{error}</p>}

      <div>
        <label className="text-xs text-gray-400 block mb-1">Titolo *</label>
        <input value={form.titolo} onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))}
          placeholder="es. Rinnovo contratto 2027"
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Tipo</label>
          <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
            <option value="rinnovo">Rinnovo</option>
            <option value="rilascio">Rilascio</option>
            <option value="riunione_cliente">Riunione cliente</option>
            <option value="interno">Interno</option>
            <option value="checkpoint">Checkpoint</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Urgenza</label>
          <select value={form.urgenza} onChange={e => setForm(f => ({ ...f, urgenza: e.target.value as any }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
            <option value="normale">Normale</option>
            <option value="alta">Alta</option>
            <option value="critica">Critica</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Data *</label>
          <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {progetti.length > 0 && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Progetto</label>
            <select value={form.progetto_id} onChange={e => setForm(f => ({ ...f, progetto_id: e.target.value }))}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
              <option value="">Nessun progetto</option>
              {progetti.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-gray-400 block mb-1">Referente</label>
          <select value={form.referente} onChange={e => setForm(f => ({ ...f, referente: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
            <option value="">Nessuno</option>
            {referentiTeam.filter(p => p.tipo === 'operativo').map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 block mb-1">Note</label>
        <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          placeholder="Note opzionali"
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">
          Annulla
        </button>
        <button onClick={handleSalva} disabled={saving}
          className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
          {saving ? 'Salvataggio...' : 'Salva scadenza'}
        </button>
      </div>
    </div>
  )
}


// ── Form nuovo contatto ───────────────────────────────────────────────────

function NuovoContattoForm({ clienteId, onClose, onSaved }: {
  clienteId: string
  onClose: () => void
  onSaved: (c: any) => void
}) {
  const [form, setForm] = useState({
    nome: '', ruolo: '', email: '', telefono: '', principale: false
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSalva() {
    if (!form.nome.trim()) { setError('Nome obbligatorio'); return }
    setSaving(true)
    const contatto = {
      id: `cont_${clienteId}_${Date.now()}`,
      cliente: clienteId,
      nome: form.nome.trim(),
      ruolo: form.ruolo.trim() || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      principale: form.principale,
    }
    try {
      await sbPost('contatti', contatto)
      onSaved(contatto)
    } catch(e: any) {
      // Salvo comunque in sessione
      onSaved(contatto)
    }
    setSaving(false)
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
      <p className="text-xs text-gray-500 font-medium">Nuovo contatto</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Nome *</label>
          <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Ruolo</label>
          <input value={form.ruolo} onChange={e => setForm(f => ({ ...f, ruolo: e.target.value }))}
            placeholder="es. Responsabile Marketing"
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Telefono</label>
          <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none" />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.principale} onChange={e => setForm(f => ({ ...f, principale: e.target.checked }))}
          className="rounded accent-teal-500" />
        <span className="text-xs text-gray-600">Contatto principale</span>
      </label>
      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500">Annulla</button>
        <button onClick={handleSalva} disabled={saving}
          className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
          style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
          {saving ? 'Salvataggio...' : 'Aggiungi'}
        </button>
      </div>
    </div>
  )
}

// ── Form nuovo task singolo ───────────────────────────────────────────────

function NuovoTaskForm({ clienteId, progettoAttivoId, progetti, personaById, onClose, onSaved }: {
  clienteId: string
  progettoAttivoId: string | null
  progetti: any[]
  personaById: Record<string, any>
  onClose: () => void
  onSaved: (t: any) => void
}) {
  const [form, setForm] = useState({
    titolo: '',
    area: 'Web',
    milestone: '',
    priorita: 'media' as TaskPriorita,
    stato: 'da_fare' as TaskStato,
    ore_stimate: '',
    data_inizio: '',
    data_fine: '',
    assegnatari: [] as string[],
    progetto_id: progettoAttivoId ?? '',
    ricorrente: false,
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const operativi = Object.values(personaById).filter((p: any) => p.tipo === 'operativo')

  async function handleSalva() {
    if (!form.titolo.trim()) { setError('Titolo obbligatorio'); return }
    if (!form.data_fine) { setError('Data fine obbligatoria'); return }
    setSaving(true)
    const task = {
      id: `task_${clienteId}_${Date.now()}`,
      cliente: clienteId,
      progetto_id: form.progetto_id || null,
      area: form.area,
      milestone: form.milestone || null,
      titolo: form.titolo.trim(),
      assegnatari: form.assegnatari,
      ore_stimate: Number(form.ore_stimate) || 0,
      data_inizio: form.data_inizio || form.data_fine,
      data_fine: form.data_fine,
      priorita: form.priorita,
      stato: form.stato,
      ricorrente: form.ricorrente,
      note: form.note || null,
    }
    try {
      await sbPost('tasks', task)
    } catch(e) { console.error('Salva task:', e) }
    setSaving(false)
    onSaved(task)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-4">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Nuovo task</p>
      {error && <p className="text-xs text-red-600 px-3 py-2 rounded-lg" style={{ background: '#FFEBEE' }}>{error}</p>}

      <div>
        <label className="text-xs text-gray-400 block mb-1">Titolo *</label>
        <input value={form.titolo} onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))}
          placeholder="Descrizione del task"
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Area</label>
          <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
            {['Web', 'ADV', 'Content', 'Strategia', 'Grafica', 'Gestione'].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Priorità</label>
          <select value={form.priorita} onChange={e => setForm(f => ({ ...f, priorita: e.target.value as TaskPriorita }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="bassa">Bassa</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Stato</label>
          <select value={form.stato} onChange={e => setForm(f => ({ ...f, stato: e.target.value as TaskStato }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
            <option value="da_fare">Da fare</option>
            <option value="in_corso">In corso</option>
            <option value="completato">Completato</option>
            <option value="bloccato">Bloccato</option>
            <option value="in_attesa_materiali">Attesa materiali</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Data inizio</label>
          <input type="date" value={form.data_inizio} onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Data fine *</label>
          <input type="date" value={form.data_fine} onChange={e => setForm(f => ({ ...f, data_fine: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Ore stimate</label>
          <input type="number" value={form.ore_stimate} onChange={e => setForm(f => ({ ...f, ore_stimate: e.target.value }))}
            placeholder="es. 4"
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Assegnatari</label>
          <div className="flex gap-2 flex-wrap">
            {operativi.map((p: any) => (
              <label key={p.id} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox"
                  checked={form.assegnatari.includes(p.id)}
                  onChange={e => setForm(f => ({
                    ...f,
                    assegnatari: e.target.checked
                      ? [...f.assegnatari, p.id]
                      : f.assegnatari.filter(id => id !== p.id)
                  }))}
                  className="rounded accent-teal-500" />
                <span className="text-xs text-gray-700">{p.nome.split(' ')[0]}</span>
              </label>
            ))}
          </div>
        </div>
        {progetti.length > 0 && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Progetto</label>
            <select value={form.progetto_id} onChange={e => setForm(f => ({ ...f, progetto_id: e.target.value }))}
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
              <option value="">Nessun progetto</option>
              {progetti.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">
          Annulla
        </button>
        <button onClick={handleSalva} disabled={saving}
          className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
          {saving ? 'Salvataggio...' : 'Crea task'}
        </button>
      </div>
    </div>
  )
}


// ── Form modifica progetto ────────────────────────────────────────────────

function ModificaProgettoForm({ progetto, onClose, onSaved }: {
  progetto: any
  onClose: () => void
  onSaved: (p: any) => void
}) {
  const [form, setForm] = useState({
    nome: progetto.nome ?? '',
    anno: progetto.anno ?? new Date().getFullYear(),
    ore_contratto: String(progetto.ore_contratto ?? ''),
    importo_contratto: String(progetto.importo_contratto ?? ''),
    data_inizio: progetto.data_inizio ?? '',
    data_fine: progetto.data_fine ?? '',
    rinnovo_previsto: progetto.rinnovo_previsto ?? '',
    stato: progetto.stato ?? 'attivo',
    note_commerciali: progetto.note_commerciali ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSalva() {
    setSaving(true)
    const updates = {
      nome: form.nome.trim(),
      anno: Number(form.anno),
      ore_contratto: Number(form.ore_contratto) || 0,
      importo_contratto: Number(form.importo_contratto) || 0,
      data_inizio: form.data_inizio || null,
      data_fine: form.data_fine || null,
      rinnovo_previsto: form.rinnovo_previsto || null,
      stato: form.stato,
      note_commerciali: form.note_commerciali || null,
    }
    try {
      await sbPatch('progetti', progetto.id, updates)
    } catch(e) { console.error('Modifica progetto:', e) }
    setSaving(false)
    onSaved({ ...progetto, ...updates })
  }

  return (
    <div className="mt-3 p-4 rounded-xl border border-teal-200 space-y-3" style={{ background: '#F0FDFB' }}>
      <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Modifica progetto</p>

      <div>
        <label className="text-xs text-gray-400 block mb-1">Nome</label>
        <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Anno</label>
          <input type="number" value={form.anno} onChange={e => setForm(f => ({ ...f, anno: Number(e.target.value) }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Ore progetto</label>
          <input type="number" value={form.ore_contratto} onChange={e => setForm(f => ({ ...f, ore_contratto: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Stato</label>
          <select value={form.stato} onChange={e => setForm(f => ({ ...f, stato: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
            <option value="attivo">Attivo</option>
            <option value="concluso">Concluso</option>
            <option value="sospeso">Sospeso</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Data inizio</label>
          <input type="date" value={form.data_inizio} onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Data fine / scadenza</label>
          <input type="date" value={form.data_fine} onChange={e => setForm(f => ({ ...f, data_fine: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Importo contratto (€)</label>
          <input type="number" value={form.importo_contratto} onChange={e => setForm(f => ({ ...f, importo_contratto: e.target.value }))}
            placeholder="es. 8400"
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Stato</label>
          <select value={form.stato} onChange={e => setForm(f => ({ ...f, stato: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
            <option value="attivo">Attivo</option>
            <option value="concluso">Concluso</option>
            <option value="sospeso">Sospeso</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 block mb-1">Rinnovo previsto</label>
        <input type="date" value={form.rinnovo_previsto} onChange={e => setForm(f => ({ ...f, rinnovo_previsto: e.target.value }))}
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
      </div>

      <div>
        <label className="text-xs text-gray-400 block mb-1">Note commerciali</label>
        <textarea value={form.note_commerciali} onChange={e => setForm(f => ({ ...f, note_commerciali: e.target.value }))}
          rows={2} placeholder="Note su rinnovo, add-on, condizioni..."
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none resize-none" />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">Annulla</button>
        <button onClick={handleSalva} disabled={saving}
          className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
          {saving ? 'Salvataggio...' : 'Salva modifiche'}
        </button>
      </div>
    </div>
  )
}

// ── Tab Costi Esterni ─────────────────────────────────────────────────────

function CostiEsterniTab({ clienteId, progettoAttivoId, progettoNome }: {
  clienteId: string
  progettoAttivoId: string | null
  progettoNome: string
}) {
  const [costi, setCosti] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ descrizione: '', fornitore: '', importo: '', data: '' })
  const [saving, setSaving] = useState(false)

  const SUPABASE_URL = 'https://ckkdrtzyowhbddpoziha.supabase.co'
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2RydHp5b3doYmRkcG96aWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzU2MzcsImV4cCI6MjA5ODA1MTYzN30.0BSBbjKmrdGtmtr2N2RCIQUZDxGkHObcWYguoarFC2I'
  const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }

  useEffect(() => {
    if (!progettoAttivoId) { setLoading(false); return }
    fetch(`${SUPABASE_URL}/rest/v1/costi_progetto?progetto_id=eq.${progettoAttivoId}&order=data.desc`, { headers })
      .then(r => r.json())
      .then(data => { setCosti(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [progettoAttivoId])

  async function handleSalva() {
    if (!form.descrizione.trim() || !form.importo) return
    setSaving(true)
    const costo = {
      id: `costo_${clienteId}_${Date.now()}`,
      progetto_id: progettoAttivoId,
      cliente: clienteId,
      descrizione: form.descrizione.trim(),
      fornitore: form.fornitore.trim() || null,
      importo: Number(form.importo),
      data: form.data || null,
    }
    try {
      await sbPost('costi_progetto', costo)
      setCosti(prev => [costo, ...prev])
      setForm({ descrizione: '', fornitore: '', importo: '', data: '' })
      setShowForm(false)
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function handleElimina(id: string) {
    try {
      await sbDelete('costi_progetto', id)
      setCosti(prev => prev.filter(c => c.id !== id))
    } catch(e) { console.error(e) }
  }

  const totale = costi.reduce((s, c) => s + (Number(c.importo) || 0), 0)

  if (!progettoAttivoId) return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-sm text-gray-400">Nessun progetto selezionato. Crea prima un progetto.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Progetto: <span className="font-medium text-gray-700">{progettoNome}</span></p>
          {costi.length > 0 && <p className="text-sm font-semibold text-gray-900 mt-1">Totale: €{totale.toLocaleString('it-IT', {minimumFractionDigits: 2})}</p>}
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
          style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
          {showForm ? 'Annulla' : '+ Aggiungi costo'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 block mb-1">Descrizione *</label>
              <input value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))}
                placeholder="es. Acquisto foto stock, Hosting annuale..."
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Fornitore / Servizio</label>
              <input value={form.fornitore} onChange={e => setForm(f => ({ ...f, fornitore: e.target.value }))}
                placeholder="es. Shutterstock, AWS..."
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Importo (€) *</label>
              <input type="number" value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))}
                placeholder="es. 150"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Data</label>
              <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600">Annulla</button>
            <button onClick={handleSalva} disabled={saving}
              className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
              {saving ? 'Salvataggio...' : 'Aggiungi'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Caricamento...</p>
      ) : costi.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-400">Nessun costo esterno registrato per questo progetto.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E0E0E0' }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrizione</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fornitore</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Importo</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {costi.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < costi.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.descrizione}</td>
                  <td className="px-4 py-3 text-gray-500">{c.fornitore || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.data ? formatDate(c.data) : '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">€{Number(c.importo).toLocaleString('it-IT', {minimumFractionDigits: 2})}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleElimina(c.id)} className="text-gray-300 hover:text-red-400 transition-colors text-xs">✕</button>
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #E0E0E0', background: '#F8F9FA' }}>
                <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Totale</td>
                <td className="px-4 py-2.5 text-right font-bold text-gray-900">€{totale.toLocaleString('it-IT', {minimumFractionDigits: 2})}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Totale costi esterni (mini widget per stat card) ──────────────────────

function CostiEsterniTotale({ progettoAttivoId }: { progettoAttivoId: string | null }) {
  const [totale, setTotale] = useState<number | null>(null)

  const SUPABASE_URL = 'https://ckkdrtzyowhbddpoziha.supabase.co'
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2RydHp5b3doYmRkcG96aWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzU2MzcsImV4cCI6MjA5ODA1MTYzN30.0BSBbjKmrdGtmtr2N2RCIQUZDxGkHObcWYguoarFC2I'

  useEffect(() => {
    if (!progettoAttivoId) { setTotale(0); return }
    fetch(`${SUPABASE_URL}/rest/v1/costi_progetto?progetto_id=eq.${progettoAttivoId}&select=importo`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    })
      .then(r => r.json())
      .then(data => {
        const tot = Array.isArray(data) ? data.reduce((s: number, c: any) => s + (Number(c.importo) || 0), 0) : 0
        setTotale(tot)
      })
      .catch(() => setTotale(0))
  }, [progettoAttivoId])

  if (!totale) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-400 mb-1">Costi esterni</p>
      <p className="text-2xl font-bold text-gray-900">€{totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
      <p className="text-xs text-gray-400 mt-1">totale progetto</p>
    </div>
  )
}

// ── Torta ore effettive (per risorsa o per area) ──────────────────────────

const AREA_COLORS_PIE: Record<string, string> = {
  web: '#4F86C6', social: '#E07B54', adv: '#7DF5DF', email: '#A67DC6', meeting: '#639922'
}
const AREA_LABELS: Record<string, string> = {
  web: 'Web', social: 'Social', adv: 'ADV', email: 'Email', meeting: 'Meeting'
}

function OreEffettiveTorta({ clienteId, tipo, team }: {
  clienteId: string
  tipo: 'risorsa' | 'area'
  team: any[]
}) {
  const [dati, setDati] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const SUPABASE_URL = 'https://ckkdrtzyowhbddpoziha.supabase.co'
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2RydHp5b3doYmRkcG96aWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzU2MzcsImV4cCI6MjA5ODA1MTYzN30.0BSBbjKmrdGtmtr2N2RCIQUZDxGkHObcWYguoarFC2I'

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/ore_effettive_dettaglio?cliente=eq.${clienteId}&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    })
      .then(r => r.json())
      .then(rows => {
        if (!Array.isArray(rows)) { setDati([]); setLoading(false); return }

        if (tipo === 'risorsa') {
          const byRisorsa: Record<string, number> = {}
          rows.forEach((r: any) => {
            const tot = (r.mesi ?? []).reduce((s: number, v: number) => s + (Number(v) || 0), 0)
            byRisorsa[r.risorsa] = (byRisorsa[r.risorsa] ?? 0) + tot
          })
          const result = Object.entries(byRisorsa).map(([pid, value]) => {
            const p = team.find((t: any) => t.id === pid)
            return { name: p?.nome?.split(' ')[0] ?? pid, value: Math.round((value as number) * 100) / 100, colore: p?.colore ?? '#ccc' }
          }).filter(d => d.value > 0).sort((a, b) => b.value - a.value)
          setDati(result)
        } else {
          const byArea: Record<string, number> = {}
          rows.forEach((r: any) => {
            const tot = (r.mesi ?? []).reduce((s: number, v: number) => s + (Number(v) || 0), 0)
            byArea[r.area] = (byArea[r.area] ?? 0) + tot
          })
          const result = Object.entries(byArea).map(([area, value]) => ({
            name: AREA_LABELS[area] ?? area,
            value: Math.round((value as number) * 100) / 100,
            colore: AREA_COLORS_PIE[area] ?? '#ccc'
          })).filter(d => d.value > 0).sort((a, b) => b.value - a.value)
          setDati(result)
        }
        setLoading(false)
      })
      .catch(() => { setDati([]); setLoading(false) })
  }, [clienteId, tipo])

  if (loading) return <p className="text-xs text-gray-400 text-center py-8">Caricamento...</p>
  if (dati.length === 0) return <p className="text-xs text-gray-400 text-center py-8">Nessun dato</p>

  return (
    <div className="flex items-center gap-3">
      <ResponsiveContainer width={90} height={90}>
        <PieChart>
          <Pie data={dati} dataKey="value" cx="50%" cy="50%" innerRadius={24} outerRadius={42} paddingAngle={2}>
            {dati.map((e, i) => <Cell key={i} fill={e.colore} />)}
          </Pie>
          <Tooltip formatter={(v: number) => [`${v}h`, '']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1">
        {dati.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: d.colore }} />
            <span className="text-xs text-gray-700">{d.name}</span>
            <span className="text-xs font-semibold text-gray-900 ml-auto pl-1">{d.value}h</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Form modifica contatto ────────────────────────────────────────────────

function ModificaContattoForm({ contatto, onClose, onSaved }: {
  contatto: any
  onClose: () => void
  onSaved: (c: any) => void
}) {
  const [form, setForm] = useState({
    nome: contatto.nome ?? '',
    ruolo: contatto.ruolo ?? '',
    email: contatto.email ?? '',
    telefono: contatto.telefono ?? '',
    principale: contatto.principale ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSalva() {
    if (!form.nome.trim()) { setError('Nome obbligatorio'); return }
    setSaving(true)
    const updates = {
      nome: form.nome.trim(),
      ruolo: form.ruolo.trim() || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      principale: form.principale,
    }
    try {
      await sbPatch('contatti', contatto.id, updates)
    } catch(e) { console.error('Modifica contatto:', e) }
    setSaving(false)
    onSaved({ ...contatto, ...updates })
  }

  return (
    <div className="p-4 space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Nome *</label>
          <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Ruolo</label>
          <input value={form.ruolo} onChange={e => setForm(f => ({ ...f, ruolo: e.target.value }))}
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Telefono</label>
          <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
            className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none" />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.principale} onChange={e => setForm(f => ({ ...f, principale: e.target.checked }))}
          className="rounded accent-teal-500" />
        <span className="text-xs text-gray-600">Contatto principale</span>
      </label>
      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500">Annulla</button>
        <button onClick={handleSalva} disabled={saving}
          className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
          style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
          {saving ? 'Salvataggio...' : 'Salva modifiche'}
        </button>
      </div>
    </div>
  )
}
