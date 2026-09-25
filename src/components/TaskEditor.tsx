/**
 * TaskEditor — Fase 2B
 * Editor task progressivo con sezioni A (attività) B (assegnazioni) C (pianificazione) D (dettagli).
 * Sostituisce TaskModal per le nuove viste. TaskModal rimane per le viste legacy.
 */
import React, { useState, useEffect, useMemo } from 'react'
import { Task, Persona, Progetto, Scadenza, TaskStato, TaskPriorita, BloccTipo, Assegnazione, Allocazione, TaskConDati } from '../types'
import { NuovoTaskInput } from '../lib/taskData'

const AREE = ['web', 'adv', 'seo', 'social', 'content', 'meeting', 'strategy', 'admin', 'altro']

const STATI: { value: TaskStato; label: string; dot: string }[] = [
  { value: 'da_fare', label: 'Da fare', dot: '#888' },
  { value: 'in_corso', label: 'In corso', dot: '#1D9E75' },
  { value: 'completato', label: 'Completato', dot: '#639922' },
  { value: 'annullato', label: 'Annullato', dot: '#ccc' },
]

const PRIORITA: { value: TaskPriorita; label: string; color: string }[] = [
  { value: 'urgente', label: 'Urgente', color: '#C62828' },
  { value: 'alta', label: 'Alta', color: '#E24B4A' },
  { value: 'media', label: 'Media', color: '#EF9F27' },
  { value: 'bassa', label: 'Bassa', color: '#639922' },
]

const BLOCCHI: { value: BloccTipo; label: string }[] = [
  { value: 'nessuno', label: 'Nessun blocco' },
  { value: 'attesa_cliente', label: 'Attesa cliente' },
  { value: 'attesa_materiali', label: 'Attesa materiali' },
  { value: 'dipendenza_interna', label: 'Dipendenza interna' },
  { value: 'altro', label: 'Altro' },
]

interface AssegnazioneForm { persona_id: string; ore_assegnate: string }
interface AllocazioneForm { persona_id: string; data: string; ore: string; note: string }

interface TaskEditorProps {
  // Contesto
  team: Persona[]
  clienti: { id: string; nome: string }[]
  progetti: Progetto[]
  scadenze: Scadenza[]
  // Precompilazione
  taskEsistente?: TaskConDati | null
  defaultCliente?: string
  defaultProgetto?: string
  // Callbacks
  onSave: (input: NuovoTaskInput) => Promise<void>
  onClose: () => void
  // Azioni speciali
  onCompleta?: (liberaFuture: boolean) => Promise<void>
  onArchivia?: () => Promise<void>
  onRipristina?: () => Promise<void>
}

export default function TaskEditor({
  team, clienti, progetti, scadenze,
  taskEsistente, defaultCliente, defaultProgetto,
  onSave, onClose, onCompleta, onArchivia, onRipristina
}: TaskEditorProps) {

  const isModifica = !!taskEsistente

  // ── Sezione A ───────────────────────────────────────────────────
  const [cliente, setCliente] = useState(taskEsistente?.cliente ?? defaultCliente ?? '')
  const [progetto, setProgetto] = useState(taskEsistente?.progetto_id ?? defaultProgetto ?? '')
  const [titolo, setTitolo] = useState(taskEsistente?.titolo ?? '')
  const [area, setArea] = useState(taskEsistente?.area ?? 'web')
  const [oreStimate, setOreStimate] = useState(taskEsistente?.ore_stimate?.toString() ?? '')
  const [deadline, setDeadline] = useState(taskEsistente?.deadline ?? taskEsistente?.data_fine ?? '')
  const [priorita, setPriorita] = useState<TaskPriorita>(taskEsistente?.priorita ?? 'media')
  const [stato, setStato] = useState<TaskStato>(taskEsistente?.stato ?? 'da_fare')

  // ── Sezione B ───────────────────────────────────────────────────
  const [assegnazioni, setAssegnazioni] = useState<AssegnazioneForm[]>(() =>
    taskEsistente?.assegnazioni?.map(a => ({ persona_id: a.persona_id, ore_assegnate: a.ore_assegnate.toString() })) ?? []
  )

  // ── Sezione C ───────────────────────────────────────────────────
  const [allocazioni, setAllocazioni] = useState<AllocazioneForm[]>([])
  const [nuovaAlloc, setNuovaAlloc] = useState<AllocazioneForm>({ persona_id: '', data: '', ore: '', note: '' })

  // ── Sezione D ───────────────────────────────────────────────────
  const [milestoneId, setMilestoneId] = useState(taskEsistente?.milestone_id ?? '')
  const [bloccTipo, setBloccTipo] = useState<BloccTipo>(taskEsistente?.blocco_tipo ?? 'nessuno')
  const [bloccNote, setBloccNote] = useState(taskEsistente?.blocco_note ?? '')
  const [noteTask, setNoteTask] = useState(taskEsistente?.note ?? '')
  const [linkOperativo, setLinkOperativo] = useState(taskEsistente?.link_operativo ?? '')
  const [sezioneD, setSezioneD] = useState(false)

  // ── UI state ────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warningOre, setWarningOre] = useState(false)
  const [completaDialog, setCompletaDialog] = useState(false)
  const [ripristinaConfirm, setRipristinaConfirm] = useState(false)

  // Progetti filtrati per cliente
  const progettiFiltrati = useMemo(() =>
    progetti.filter(p => p.cliente === cliente && ['attivo','pianificato'].includes(p.stato)),
    [progetti, cliente]
  )

  // Auto-seleziona progetto se unico
  useEffect(() => {
    if (!progetto && progettiFiltrati.length === 1) setProgetto(progettiFiltrati[0].id)
  }, [progettiFiltrati, progetto])

  // Milestone coerenti con il progetto
  const milestoneDisponibili = useMemo(() =>
    scadenze.filter(s => s.cliente === cliente && (!progetto || s.progetto_id === progetto || !s.progetto_id)),
    [scadenze, cliente, progetto]
  )

  // Calcoli pianificazione
  const oreStimateNum = oreStimate ? parseFloat(oreStimate) : null
  const oreAssegnateTot = assegnazioni.reduce((s, a) => s + (parseFloat(a.ore_assegnate) || 0), 0)
  const oreAllocateTot = (taskEsistente?.ore_pianificate_totali ?? 0) + allocazioni.reduce((s, a) => s + (parseFloat(a.ore) || 0), 0)
  const oreDaAssegnare = oreStimateNum !== null ? Math.max(0, oreStimateNum - oreAssegnateTot) : null
  const oreDaPianificare = Math.max(0, oreAssegnateTot - oreAllocateTot)

  // Operativi disponibili
  const operativi = team.filter(p => p.tipo === 'operativo')
  const personaAssegnata = (id: string) => assegnazioni.some(a => a.persona_id === id)

  function aggiungiAssegnazione(personaId: string) {
    if (personaAssegnata(personaId)) return
    setAssegnazioni(prev => [...prev, { persona_id: personaId, ore_assegnate: '' }])
  }

  function rimuoviAssegnazione(idx: number) {
    setAssegnazioni(prev => prev.filter((_, i) => i !== idx))
  }

  function aggiungiAllocazione() {
    if (!nuovaAlloc.persona_id || !nuovaAlloc.data || !nuovaAlloc.ore) return
    const ore = parseFloat(nuovaAlloc.ore)
    const asgnCorr = assegnazioni.find(a => a.persona_id === nuovaAlloc.persona_id)
    const oreAsgn = parseFloat(asgnCorr?.ore_assegnate ?? '0') || 0
    const giàAlloc = (taskEsistente?.allocazioni?.filter(a => {
      const asgnId = taskEsistente.assegnazioni.find(as => as.persona_id === nuovaAlloc.persona_id)?.id
      return a.assegnazione_id === asgnId
    })?.reduce((s, a) => s + a.ore, 0) ?? 0) +
    allocazioni.filter(a => a.persona_id === nuovaAlloc.persona_id).reduce((s, a) => s + (parseFloat(a.ore)||0), 0)

    if (giàAlloc + ore > oreAsgn) {
      setError(`Sovra-pianificazione: ${team.find(p => p.id === nuovaAlloc.persona_id)?.nome} ha ${oreAsgn}h assegnate, già pianificate ${giàAlloc}h`)
      return
    }
    setAllocazioni(prev => [...prev, { ...nuovaAlloc }])
    setNuovaAlloc({ persona_id: nuovaAlloc.persona_id, data: '', ore: '', note: '' })
  }

  async function handleSave() {
    if (!titolo.trim()) { setError('Il titolo è obbligatorio'); return }
    if (!cliente) { setError('Seleziona un cliente'); return }
    if (!area) { setError('Seleziona un\'area'); return }

    // Controllo assegnazioni oltre stima
    if (oreStimateNum !== null && oreAssegnateTot > oreStimateNum && !warningOre) {
      setWarningOre(true)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const asgnInput = assegnazioni
        .filter(a => a.persona_id && parseFloat(a.ore_assegnate) > 0)
        .map(a => ({ persona_id: a.persona_id, ore_assegnate: parseFloat(a.ore_assegnate) }))

      const allocInput = allocazioni
        .filter(a => a.persona_id && a.data && parseFloat(a.ore) > 0)
        .map(a => ({ assegnazione_persona_id: a.persona_id, data: a.data, ore: parseFloat(a.ore), note: a.note || undefined }))

      await onSave({
        id: taskEsistente?.id,
        cliente, progetto_id: progetto || null, area, titolo,
        ore_stimate: oreStimateNum, deadline: deadline || null,
        priorita, stato, note: noteTask || null,
        milestone_id: milestoneId || null, link_operativo: linkOperativo || null,
        blocco_tipo: bloccTipo !== 'nessuno' ? bloccTipo : null,
        blocco_note: bloccNote || null,
        assegnazioni: asgnInput,
        allocazioni: allocInput,
      })
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
      setWarningOre(false)
    }
  }

  const allocazioniFuture = useMemo(() => {
    if (!taskEsistente) return []
    const oggi = new Date().toISOString().split('T')[0]
    return taskEsistente.allocazioni.filter(a => a.data_inizio > oggi)
  }, [taskEsistente])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">
            {isModifica ? 'Modifica attività' : 'Nuova attività'}
          </h3>
          <div className="flex items-center gap-2">
            {isModifica && onArchivia && (
              <button onClick={onArchivia} className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 rounded">Archivia</button>
            )}
            {isModifica && stato === 'completato' && onRipristina && (
              <div className="flex items-center gap-2">
                {ripristinaConfirm ? (
                  <>
                    <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                      Le pianificazioni liberate non vengono ripristinate.
                    </span>
                    <button onClick={() => { onRipristina(); setRipristinaConfirm(false) }}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium bg-amber-600 text-white">
                      Conferma
                    </button>
                    <button onClick={() => setRipristinaConfirm(false)}
                      className="text-xs px-2 py-1.5 text-gray-500">
                      Annulla
                    </button>
                  </>
                ) : (
                  <button onClick={() => setRipristinaConfirm(true)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: '#FEF3C7', color: '#92400E' }}>
                    ↺ Riapri
                  </button>
                )}
              </div>
            )}
            {isModifica && onCompleta && stato !== 'completato' && (
              <button onClick={() => allocazioniFuture.length > 0 ? setCompletaDialog(true) : onCompleta(false)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#EAF3DE', color: '#27500A' }}>
                Completa
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

          {/* Warning ore oltre stima */}
          {warningOre && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-amber-800">
                Le ore assegnate ({oreAssegnateTot}h) superano la stima ({oreStimateNum}h).
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setOreStimate(oreAssegnateTot.toString()); setWarningOre(false) }}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium bg-amber-600 text-white">
                  Aggiorna stima a {oreAssegnateTot}h e salva
                </button>
                <button onClick={() => setWarningOre(false)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700">
                  Torna alle assegnazioni
                </button>
              </div>
            </div>
          )}

          {/* ── Sezione A — Attività ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Attività</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cliente *</label>
                <select value={cliente} onChange={e => { setCliente(e.target.value); setProgetto('') }}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:border-teal-400">
                  <option value="">— Seleziona —</option>
                  {clienti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Progetto</label>
                <select value={progetto} onChange={e => setProgetto(e.target.value)}
                  disabled={!cliente || progettiFiltrati.length === 0}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:border-teal-400 disabled:opacity-50">
                  <option value="">— Nessuno —</option>
                  {progettiFiltrati.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Nome attività *</label>
              <input value={titolo} onChange={e => setTitolo(e.target.value)}
                placeholder="Descrivi brevemente l'attività"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Area *</label>
                <select value={area} onChange={e => setArea(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
                  {AREE.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Ore stimate</label>
                <input type="number" min="0" step="0.5" value={oreStimate} onChange={e => setOreStimate(e.target.value)}
                  placeholder="—"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Deadline</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Stato</label>
                <select value={stato} onChange={e => setStato(e.target.value as TaskStato)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
                  {STATI.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Priorità</label>
              <div className="flex gap-2">
                {PRIORITA.map(p => (
                  <button key={p.value} onClick={() => setPriorita(p.value)}
                    className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                    style={{
                      borderColor: priorita === p.value ? p.color : '#E5E7EB',
                      background: priorita === p.value ? p.color + '22' : 'white',
                      color: priorita === p.value ? p.color : '#6B7280',
                      fontWeight: priorita === p.value ? 600 : 400,
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Sezione B — Assegnazioni ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Assegnazioni</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {oreStimateNum !== null && (
                  <>
                    <span>Stima: <strong>{oreStimateNum}h</strong></span>
                    <span>Assegnate: <strong style={{ color: oreAssegnateTot > oreStimateNum ? '#E24B4A' : '#1D9E75' }}>{oreAssegnateTot}h</strong></span>
                    <span>Da assegnare: <strong>{oreDaAssegnare}h</strong></span>
                  </>
                )}
                {oreStimateNum === null && oreAssegnateTot > 0 && (
                  <span>Assegnate: <strong>{oreAssegnateTot}h</strong> (nessuna stima)</span>
                )}
              </div>
            </div>

            {/* Lista assegnazioni */}
            {assegnazioni.length > 0 && (
              <div className="space-y-2">
                {assegnazioni.map((a, i) => {
                  const persona = team.find(p => p.id === a.persona_id)
                  return (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: persona?.colore ?? '#888' }}>
                        {persona?.nome.charAt(0) ?? '?'}
                      </div>
                      <span className="text-sm text-gray-700 flex-1">{persona?.nome ?? a.persona_id}</span>
                      <input type="number" min="0.5" step="0.5" value={a.ore_assegnate}
                        onChange={e => setAssegnazioni(prev => prev.map((x, j) => j===i ? {...x, ore_assegnate: e.target.value} : x))}
                        placeholder="ore"
                        className="w-20 text-sm text-right px-2 py-1 rounded-lg border border-gray-200 outline-none" />
                      <span className="text-xs text-gray-400">h</span>
                      <button onClick={() => rimuoviAssegnazione(i)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Aggiunge persona */}
            <div className="flex gap-2 flex-wrap">
              {operativi.filter(p => !personaAssegnata(p.id)).map(p => (
                <button key={p.id} onClick={() => aggiungiAssegnazione(p.id)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-gray-200 hover:border-gray-400 text-gray-500 hover:text-gray-700 transition-colors">
                  <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white" style={{ background: p.colore, fontSize: 9 }}>{p.nome.charAt(0)}</span>
                  + {p.nome.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* ── Sezione C — Pianificazione ── */}
          {assegnazioni.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pianificazione</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>Pianificate: <strong>{oreAllocateTot}h</strong></span>
                  <span>Da pianificare: <strong style={{ color: oreDaPianificare > 0 ? '#EF9F27' : '#1D9E75' }}>{oreDaPianificare}h</strong></span>
                </div>
              </div>

              {/* Allocazioni esistenti */}
              {taskEsistente && taskEsistente.allocazioni.length > 0 && (
                <div className="space-y-1">
                  {taskEsistente.allocazioni.map(alloc => {
                    const asgn = taskEsistente.assegnazioni.find(a => a.id === alloc.assegnazione_id)
                    const persona = team.find(p => p.id === asgn?.persona_id)
                    return (
                      <div key={alloc.id} className="flex items-center gap-3 text-xs bg-gray-50 rounded-lg px-3 py-2">
                        <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white flex-shrink-0" style={{ background: persona?.colore ?? '#888', fontSize: 9 }}>{persona?.nome.charAt(0)}</span>
                        <span className="text-gray-600">{persona?.nome.split(' ')[0]}</span>
                        <span className="text-gray-400">{alloc.data_inizio}</span>
                        <span className="font-medium text-gray-700">{alloc.ore}h</span>
                        {alloc.note && <span className="text-gray-400 flex-1 truncate">{alloc.note}</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Allocazioni nuove (sessione corrente) */}
              {allocazioni.length > 0 && (
                <div className="space-y-1">
                  {allocazioni.map((alloc, i) => {
                    const persona = team.find(p => p.id === alloc.persona_id)
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs bg-teal-50 rounded-lg px-3 py-2">
                        <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white flex-shrink-0" style={{ background: persona?.colore ?? '#888', fontSize: 9 }}>{persona?.nome.charAt(0)}</span>
                        <span className="text-gray-600">{persona?.nome.split(' ')[0]}</span>
                        <span className="text-gray-400">{alloc.data}</span>
                        <span className="font-medium text-teal-700">{alloc.ore}h</span>
                        <button onClick={() => setAllocazioni(prev => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 ml-auto">✕</button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Form nuova allocazione */}
              <div className="flex gap-2 items-end">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Persona</label>
                  <select value={nuovaAlloc.persona_id} onChange={e => setNuovaAlloc(a => ({...a, persona_id: e.target.value}))}
                    className="text-xs px-2 py-2 rounded-lg border border-gray-200 bg-white outline-none">
                    <option value="">—</option>
                    {assegnazioni.map(a => {
                      const p = team.find(x => x.id === a.persona_id)
                      return <option key={a.persona_id} value={a.persona_id}>{p?.nome.split(' ')[0] ?? a.persona_id}</option>
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Data</label>
                  <input type="date" value={nuovaAlloc.data} onChange={e => setNuovaAlloc(a => ({...a, data: e.target.value}))}
                    className="text-xs px-2 py-2 rounded-lg border border-gray-200 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Ore</label>
                  <input type="number" min="0.5" step="0.5" value={nuovaAlloc.ore} onChange={e => setNuovaAlloc(a => ({...a, ore: e.target.value}))}
                    placeholder="ore" className="w-16 text-xs px-2 py-2 rounded-lg border border-gray-200 outline-none text-center" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Nota</label>
                  <input value={nuovaAlloc.note} onChange={e => setNuovaAlloc(a => ({...a, note: e.target.value}))}
                    placeholder="opzionale" className="w-full text-xs px-2 py-2 rounded-lg border border-gray-200 outline-none" />
                </div>
                <button onClick={aggiungiAllocazione}
                  disabled={!nuovaAlloc.persona_id || !nuovaAlloc.data || !nuovaAlloc.ore}
                  className="text-xs px-3 py-2 rounded-lg font-medium disabled:opacity-40"
                  style={{ background: '#7DF5DF', color: '#1A1A2E' }}>+</button>
              </div>
              <p className="text-xs text-gray-400">La pianificazione è opzionale — puoi salvare il task senza indicare le date.</p>
            </div>
          )}

          {/* ── Sezione D — Dettagli ── */}
          <div>
            <button onClick={() => setSezioneD(v => !v)}
              className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
              {sezioneD ? '▾' : '▸'} Dettagli aggiuntivi
            </button>
            {sezioneD && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Milestone</label>
                    <select value={milestoneId} onChange={e => setMilestoneId(e.target.value)}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none">
                      <option value="">— Nessuna —</option>
                      {milestoneDisponibili.map(s => <option key={s.id} value={s.id}>{s.titolo} ({s.data})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Blocco</label>
                    <select value={bloccTipo} onChange={e => setBloccTipo(e.target.value as BloccTipo)}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                      style={{ borderColor: bloccTipo !== 'nessuno' ? '#E24B4A' : undefined }}>
                      {BLOCCHI.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                  </div>
                </div>
                {bloccTipo !== 'nessuno' && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Note blocco</label>
                    <input value={bloccNote} onChange={e => setBloccNote(e.target.value)}
                      placeholder="Spiega il blocco..."
                      className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Link operativo</label>
                  <input value={linkOperativo} onChange={e => setLinkOperativo(e.target.value)}
                    placeholder="https://..."
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Note</label>
                  <textarea value={noteTask} onChange={e => setNoteTask(e.target.value)}
                    rows={3} placeholder="Note interne..."
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none resize-none" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600">Annulla</button>
          <button onClick={handleSave} disabled={saving}
            className="text-sm px-5 py-2 rounded-lg font-medium disabled:opacity-50"
            style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
            {saving ? 'Salvataggio...' : isModifica ? 'Salva modifiche' : 'Crea attività'}
          </button>
        </div>
      </div>

      {/* Dialog completamento */}
      {completaDialog && onCompleta && (
        <div className="fixed inset-0 z-60 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="text-sm font-semibold text-gray-900 mb-2">Completa attività</p>
            <p className="text-sm text-gray-600 mb-4">
              Questo task ha ancora {allocazioniFuture.length} allocazione/i pianificate in date future.
              Vuoi liberarle?
            </p>
            <div className="flex gap-2">
              <button onClick={() => { onCompleta(true); setCompletaDialog(false); onClose() }}
                className="flex-1 text-sm py-2 rounded-lg font-medium"
                style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
                Libera ore future
              </button>
              <button onClick={() => { onCompleta(false); setCompletaDialog(false); onClose() }}
                className="flex-1 text-sm py-2 rounded-lg border border-gray-200 text-gray-700">
                Mantieni pianificazione
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
