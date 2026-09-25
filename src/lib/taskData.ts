/**
 * taskData.ts — Foundation Data Layer Fase 2B
 * Unica sorgente per task + assegnazioni + allocazioni.
 * Le viste legacy usano ancora seed.tasks + tasks.assegnatari.
 * Le nuove viste usano fetchTaskConDati() e le mutation qui sotto.
 */

import { supabase } from './supabase'
import {
  Task, Assegnazione, Allocazione, TaskConDati,
  TaskPianificazioneStato, TaskPriorita, TaskStato, BloccTipo
} from '../types'

const REST = 'https://ckkdrtzyowhbddpoziha.supabase.co/rest/v1'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2RydHp5b3doYmRkcG96aWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzU2MzcsImV4cCI6MjA5ODA1MTYzN30.0BSBbjKmrdGtmtr2N2RCIQUZDxGkHObcWYguoarFC2I'

async function headers(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? ANON
  return { 'apikey': ANON, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function get<T>(table: string, params = ''): Promise<T[]> {
  const h = await headers()
  const res = await fetch(`${REST}/${table}?${params}`, { headers: h })
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function post<T>(table: string, data: any, prefer = 'return=representation'): Promise<T> {
  const h = await headers()
  const res = await fetch(`${REST}/${table}`, {
    method: 'POST', headers: { ...h, 'Prefer': prefer }, body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`POST ${table}: ${res.status} ${await res.text()}`)
  if (prefer === 'return=minimal') return undefined as any
  const json = await res.json()
  return Array.isArray(json) ? json[0] : json
}

async function patch(table: string, id: string, data: any): Promise<void> {
  const h = await headers()
  const res = await fetch(`${REST}/${table}?id=eq.${id}`, {
    method: 'PATCH', headers: { ...h, 'Prefer': 'return=minimal' }, body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`PATCH ${table}/${id}: ${res.status} ${await res.text()}`)
}

async function del(table: string, id: string): Promise<void> {
  const h = await headers()
  const res = await fetch(`${REST}/${table}?id=eq.${id}`, { method: 'DELETE', headers: h })
  if (!res.ok) throw new Error(`DELETE ${table}/${id}: ${res.status} ${await res.text()}`)
}

// ── Utilità calcolo pianificazione ───────────────────────────────────────────

export function calcolaPianificazioneStato(
  ore_stimate: number | null,
  assegnazioni: Assegnazione[],
  allocazioni: Allocazione[]
): TaskPianificazioneStato {
  const oreAssegnate = assegnazioni.reduce((s, a) => s + a.ore_assegnate, 0)
  const orePianificate = allocazioni.reduce((s, a) => s + a.ore, 0)

  if (ore_stimate === null || ore_stimate === undefined) return 'da_stimare'
  if (oreAssegnate === 0) return 'da_assegnare'
  if (orePianificate === 0) return 'da_pianificare'
  if (orePianificate < oreAssegnate) return 'parziale'
  return 'pianificato'
}

export function arricchisciTask(
  task: Task,
  assegnazioni: Assegnazione[],
  allocazioni: Allocazione[]
): TaskConDati {
  const asgn = assegnazioni.filter(a => a.task_id === task.id)
  const alloc = allocazioni.filter(a => asgn.some(as => as.id === a.assegnazione_id))
  const oreAssegnate = asgn.reduce((s, a) => s + a.ore_assegnate, 0)
  const orePianificate = alloc.reduce((s, a) => s + a.ore, 0)

  const oggi = new Date().toISOString().split('T')[0]
  const prossima = alloc
    .filter(a => a.data_inizio >= oggi)
    .sort((a, b) => a.data_inizio.localeCompare(b.data_inizio))[0]?.data_inizio ?? null

  return {
    ...task,
    assegnazioni: asgn,
    allocazioni: alloc,
    ore_assegnate_totali: oreAssegnate,
    ore_pianificate_totali: orePianificate,
    ore_da_assegnare: task.ore_stimate !== null ? Math.max(0, task.ore_stimate - oreAssegnate) : null,
    ore_da_pianificare: Math.max(0, oreAssegnate - orePianificate),
    pianificazione_stato: calcolaPianificazioneStato(task.ore_stimate, asgn, alloc),
    prossima_data_pianificata: prossima,
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchTaskConDati(opts: {
  personaId?: string
  clienteId?: string
  includiCompletati?: boolean
  includiArchiviati?: boolean
}): Promise<TaskConDati[]> {
  let taskParams = opts.includiArchiviati ? 'select=*' : 'select=*&archived_at=is.null'
  if (!opts.includiCompletati) taskParams += '&stato=not.eq.completato&stato=not.eq.annullato'
  if (opts.clienteId) taskParams += `&cliente=eq.${opts.clienteId}`

  const tasks = await get<Task>('tasks', taskParams)

  if (tasks.length === 0) return []

  const taskIds = tasks.map(t => t.id).join(',')
  const assegnazioni = await get<Assegnazione>('assegnazioni', `select=*&task_id=in.(${taskIds})`)

  let filteredTasks = tasks
  if (opts.personaId) {
    const myTaskIds = new Set(
      assegnazioni.filter(a => a.persona_id === opts.personaId).map(a => a.task_id)
    )
    filteredTasks = tasks.filter(t => myTaskIds.has(t.id))
  }

  const allocIds = assegnazioni.map(a => a.id).join(',')
  const allocazioni = allocIds
    ? await get<Allocazione>('allocazioni', `select=*&assegnazione_id=in.(${allocIds})`)
    : []

  return filteredTasks.map(t => arricchisciTask(t, assegnazioni, allocazioni))
}

// ── Mutation atomica task + assegnazioni + allocazioni ────────────────────────

export interface NuovoTaskInput {
  id?: string
  cliente: string
  progetto_id?: string | null
  area: string
  titolo: string
  ore_stimate?: number | null
  deadline?: string | null
  priorita?: TaskPriorita
  stato?: TaskStato
  note?: string | null
  milestone_id?: string | null
  link_operativo?: string | null
  blocco_tipo?: BloccTipo | null
  blocco_note?: string | null
  assegnazioni?: { persona_id: string; ore_assegnate: number }[]
  allocazioni?: { assegnazione_persona_id: string; data: string; ore: number; note?: string }[]
}

export async function creaTaskAtomico(input: NuovoTaskInput): Promise<TaskConDati> {
  const taskId = input.id ?? `task_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
  const now = new Date().toISOString()

  // Calcola assegnatari legacy per compatibilità viste esistenti
  const assegnatariLegacy = (input.assegnazioni ?? []).map(a => a.persona_id)

  const taskData: Partial<Task> & { id: string } = {
    id: taskId,
    cliente: input.cliente,
    progetto_id: input.progetto_id ?? null,
    area: input.area,
    titolo: input.titolo,
    ore_stimate: input.ore_stimate ?? null,
    deadline: input.deadline ?? null,
    data_fine: input.deadline ?? null,  // BRIDGE LEGACY
    priorita: input.priorita ?? 'media',
    stato: input.stato ?? 'da_fare',
    note: input.note ?? null,
    milestone_id: input.milestone_id ?? null,
    link_operativo: input.link_operativo ?? null,
    blocco_tipo: input.blocco_tipo ?? null,
    blocco_note: input.blocco_note ?? null,
    assegnatari: assegnatariLegacy,      // BRIDGE LEGACY — temporaneo
    ricorrente: false,
    needs_assignment_review: false,
  }

  try {
    // 1. Crea task
    await post('tasks', taskData, 'return=minimal')

    // 2. Crea assegnazioni
    const assegnazioniCreate: Assegnazione[] = []
    for (const a of (input.assegnazioni ?? [])) {
      const asgnId = `asgn_${taskId}_${a.persona_id}_${Date.now()}`
      await post('assegnazioni', {
        id: asgnId, task_id: taskId, persona_id: a.persona_id, ore_assegnate: a.ore_assegnate
      }, 'return=minimal')
      assegnazioniCreate.push({ id: asgnId, task_id: taskId, persona_id: a.persona_id, ore_assegnate: a.ore_assegnate })
    }

    // 3. Crea allocazioni
    const allocazioniCreate: Allocazione[] = []
    for (const alloc of (input.allocazioni ?? [])) {
      const asgnCorr = assegnazioniCreate.find(a => a.persona_id === alloc.assegnazione_persona_id)
      if (!asgnCorr) throw new Error(`Assegnazione non trovata per persona ${alloc.assegnazione_persona_id}`)
      const allocId = `alloc_${asgnCorr.id}_${alloc.data}_${Date.now()}`
      await post('allocazioni', {
        id: allocId, assegnazione_id: asgnCorr.id,
        ore: alloc.ore, data_inizio: alloc.data, data_fine: alloc.data,
        note: alloc.note ?? null
      }, 'return=minimal')
      allocazioniCreate.push({ id: allocId, assegnazione_id: asgnCorr.id, ore: alloc.ore, data_inizio: alloc.data, data_fine: alloc.data })
    }

    return arricchisciTask(taskData as Task, assegnazioniCreate, allocazioniCreate)
  } catch (err) {
    // Rollback best-effort: elimina task se creato (CASCADE elimina assegnazioni e allocazioni)
    try { await del('tasks', taskId) } catch {}
    throw err
  }
}

export interface ModificaTaskInput extends Partial<NuovoTaskInput> {
  // assegnazioni: se presente, SOSTITUISCE tutte le assegnazioni esistenti
  // allocazioni: se presente, AGGIUNGE alle allocazioni esistenti (non sostituisce)
}

export async function modificaTaskAtomico(
  taskId: string,
  input: ModificaTaskInput,
  assegnazioniEsistenti: Assegnazione[],
  allocazioniEsistenti: Allocazione[]
): Promise<TaskConDati> {
  const taskUpdates: Partial<Task> = {}
  if (input.titolo !== undefined) taskUpdates.titolo = input.titolo
  if (input.area !== undefined) taskUpdates.area = input.area
  if (input.ore_stimate !== undefined) taskUpdates.ore_stimate = input.ore_stimate
  if (input.deadline !== undefined) { taskUpdates.deadline = input.deadline; taskUpdates.data_fine = input.deadline }
  if (input.priorita !== undefined) taskUpdates.priorita = input.priorita
  if (input.stato !== undefined) taskUpdates.stato = input.stato
  if (input.note !== undefined) taskUpdates.note = input.note
  if (input.milestone_id !== undefined) taskUpdates.milestone_id = input.milestone_id
  if (input.link_operativo !== undefined) taskUpdates.link_operativo = input.link_operativo
  if (input.blocco_tipo !== undefined) taskUpdates.blocco_tipo = input.blocco_tipo
  if (input.blocco_note !== undefined) taskUpdates.blocco_note = input.blocco_note
  if (input.progetto_id !== undefined) taskUpdates.progetto_id = input.progetto_id
  if (input.cliente !== undefined) taskUpdates.cliente = input.cliente

  try {
    // 1. Aggiorna task (solo se ci sono campi da aggiornare)
    if (Object.keys(taskUpdates).length > 0) {
      await patch('tasks', taskId, taskUpdates)
    }

    let assegnazioniFinali = [...assegnazioniEsistenti]
    let allocazioniFinali = [...allocazioniEsistenti]

    // 2. Se le assegnazioni cambiano, sostituisci
    if (input.assegnazioni !== undefined) {
      // Elimina assegnazioni esistenti (CASCADE su allocazioni)
      for (const a of assegnazioniEsistenti) {
        await del('assegnazioni', a.id)
      }
      assegnazioniFinali = []
      allocazioniFinali = []

      // Ricrea assegnazioni
      const nuoveAssegnazioni: Assegnazione[] = []
      for (const a of input.assegnazioni) {
        const asgnId = `asgn_${taskId}_${a.persona_id}_${Date.now()}`
        await post('assegnazioni', {
          id: asgnId, task_id: taskId, persona_id: a.persona_id, ore_assegnate: a.ore_assegnate
        }, 'return=minimal')
        nuoveAssegnazioni.push({ id: asgnId, task_id: taskId, persona_id: a.persona_id, ore_assegnate: a.ore_assegnate })
      }
      assegnazioniFinali = nuoveAssegnazioni

      // Aggiorna bridge legacy assegnatari
      const assegnatariLegacy = assegnazioniFinali.map(a => a.persona_id)
      await patch('tasks', taskId, { assegnatari: assegnatariLegacy })
    }

    // 3. Aggiungi nuove allocazioni se presenti
    if (input.allocazioni !== undefined) {
      for (const alloc of input.allocazioni) {
        const asgnCorr = assegnazioniFinali.find(a => a.persona_id === alloc.assegnazione_persona_id)
        if (!asgnCorr) throw new Error(`Assegnazione non trovata per persona ${alloc.assegnazione_persona_id}`)

        // Verifica non superi ore assegnate
        const giàPianificate = allocazioniFinali
          .filter(al => al.assegnazione_id === asgnCorr.id)
          .reduce((s, al) => s + al.ore, 0)
        if (giàPianificate + alloc.ore > asgnCorr.ore_assegnate) {
          throw new Error(`Sovra-pianificazione: ${asgnCorr.persona_id} ha ${asgnCorr.ore_assegnate}h assegnate, già pianificate ${giàPianificate}h, non puoi aggiungere ${alloc.ore}h`)
        }

        const allocId = `alloc_${asgnCorr.id}_${alloc.data}_${Date.now()}`
        await post('allocazioni', {
          id: allocId, assegnazione_id: asgnCorr.id,
          ore: alloc.ore, data_inizio: alloc.data, data_fine: alloc.data,
          note: alloc.note ?? null
        }, 'return=minimal')
        allocazioniFinali.push({ id: allocId, assegnazione_id: asgnCorr.id, ore: alloc.ore, data_inizio: alloc.data, data_fine: alloc.data })
      }
    }

    // Rileggo il task aggiornato
    const tasks = await get<Task>('tasks', `select=*&id=eq.${taskId}`)
    return arricchisciTask(tasks[0], assegnazioniFinali, allocazioniFinali)

  } catch (err) {
    throw err
  }
}

export async function completaTask(
  taskId: string,
  allocazioniFuture: Allocazione[],
  liberaFuture: boolean
): Promise<void> {
  const completedAt = new Date().toISOString()

  if (liberaFuture && allocazioniFuture.length > 0) {
    for (const alloc of allocazioniFuture) {
      await del('allocazioni', alloc.id)
    }
  }
  await patch('tasks', taskId, { stato: 'completato', completed_at: completedAt })
}

export async function archivaTask(taskId: string): Promise<void> {
  await patch('tasks', taskId, { archived_at: new Date().toISOString() })
}

export async function ripristinaTask(taskId: string): Promise<void> {
  // Ripristina a da_fare — le allocazioni liberate al completamento NON vengono ricreate
  await patch('tasks', taskId, { stato: 'da_fare', completed_at: null })
}

export async function desarchivaTask(taskId: string): Promise<void> {
  await patch('tasks', taskId, { archived_at: null })
}

export async function eliminaAllocazione(allocId: string): Promise<void> {
  await del('allocazioni', allocId)
}
