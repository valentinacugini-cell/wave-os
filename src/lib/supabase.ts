import { createClient, Session, User } from '@supabase/supabase-js'
import { Task, Assegnazione, Allocazione, CapacitaPersona, Persona } from '../types'

const SUPABASE_URL = 'https://ckkdrtzyowhbddpoziha.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2RydHp5b3doYmRkcG96aWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzU2MzcsImV4cCI6MjA5ODA1MTYzN30.0BSBbjKmrdGtmtr2N2RCIQUZDxGkHObcWYguoarFC2I'

// Client Supabase ufficiale — gestisce sessione, refresh token, onAuthStateChange
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  }
})

// ── Funzioni helper REST legacy (mantengono compatibilità con il codice esistente) ──
// Ora usano il token della sessione corrente invece dell'anon key fissa

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? SUPABASE_ANON_KEY
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function sb(table: string, params = '') {
  const headers = await getAuthHeaders()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers })
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function sbPost(table: string, data: any) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function sbPatch(table: string, id: string, data: any) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`)
}

export async function sbDelete(table: string, id: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`)
}

export async function sbUpsert(table: string, data: any) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── Foundation Data Layer — Fase 2A ──────────────────────────────────────────
// Queste funzioni leggono/scrivono le nuove entità.
// Non sono ancora usate dalle viste legacy — pronte per la Fase 2B.

// Assegnazioni
export async function fetchAssegnazioni(taskIds?: string[]): Promise<Assegnazione[]> {
  let params = 'select=*'
  if (taskIds && taskIds.length > 0) {
    params += `&task_id=in.(${taskIds.join(',')})`
  }
  return sb('assegnazioni', params)
}

export async function createAssegnazione(data: Omit<Assegnazione, 'id' | 'created_at' | 'updated_at'>): Promise<Assegnazione> {
  const id = `asgn_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
  const rows = await sbPost('assegnazioni', { ...data, id })
  return Array.isArray(rows) ? rows[0] : rows
}

export async function updateAssegnazione(id: string, data: Partial<Assegnazione>): Promise<void> {
  await sbPatch('assegnazioni', id, data)
}

export async function deleteAssegnazioneAdmin(id: string): Promise<void> {
  // Cancellazione fisica — solo uso amministrativo, non dalla normale UX
  await sbDelete('assegnazioni', id)
}

// Allocazioni
export async function fetchAllocazioni(assegnazioneIds?: string[]): Promise<Allocazione[]> {
  let params = 'select=*'
  if (assegnazioneIds && assegnazioneIds.length > 0) {
    params += `&assegnazione_id=in.(${assegnazioneIds.join(',')})`
  }
  return sb('allocazioni', params)
}

export async function createAllocazione(data: Omit<Allocazione, 'id' | 'created_at' | 'updated_at'>): Promise<Allocazione> {
  const id = `alloc_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
  const rows = await sbPost('allocazioni', { ...data, id })
  return Array.isArray(rows) ? rows[0] : rows
}

export async function updateAllocazione(id: string, data: Partial<Allocazione>): Promise<void> {
  await sbPatch('allocazioni', id, data)
}

export async function deleteAllocazione(id: string): Promise<void> {
  await sbDelete('allocazioni', id)
}

// Capacità persona
export async function fetchCapacitaPersona(personaId?: string, anno?: number): Promise<CapacitaPersona[]> {
  let params = 'select=*&order=anno,mese'
  if (personaId) params += `&persona_id=eq.${personaId}`
  if (anno) params += `&anno=eq.${anno}`
  return sb('capacita_persona', params)
}

export async function upsertCapacitaPersona(data: Omit<CapacitaPersona, 'id'> & { id?: string }): Promise<void> {
  const id = data.id ?? `cap_${data.persona_id}_${data.anno}_${data.mese}`
  const headers = await getAuthHeaders()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/capacita_persona`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ ...data, id })
  })
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`)
}

// Team — identificazione membro corrente
export async function fetchTeamMemberByAuthId(authUserId: string): Promise<Persona | null> {
  const rows = await sb('team', `select=*&auth_user_id=eq.${authUserId}`)
  if (!Array.isArray(rows) || rows.length === 0) return null
  const t = rows[0]
  return {
    ...t,
    capacita_mensile: Array.isArray(t.capacita_mensile) ? t.capacita_mensile : [],
    ore_pianificate: Array.isArray(t.ore_pianificate) ? t.ore_pianificate : [],
    ore_effettive_mensili: Array.isArray(t.ore_effettive_mensili) ? t.ore_effettive_mensili : [],
  }
}

// ── loadSeed — invariato rispetto a prima, ora usa token sessione ─────────────
export async function loadSeed() {
  const [team, clienti, scadenze, progetti, tasks, contatti, note_rinnovo, ore_det] =
    await Promise.all([
      sb('team', 'select=*'),
      sb('clienti', 'select=*'),
      sb('scadenze', 'select=*'),
      sb('progetti', 'select=*'),
      sb('tasks', 'select=*&archived_at=is.null'),
      sb('contatti', 'select=*'),
      sb('note_rinnovo', 'select=*'),
      sb('ore_effettive_dettaglio', 'select=*'),
    ])
  return { team, clienti, scadenze, progetti, tasks, contatti, note_rinnovo, ore_det }
}

export async function syncOreEffettive(timesheet: any[] = []) {
  const headers = await getAuthHeaders()
  for (const row of timesheet) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ore_effettive_dettaglio`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row)
    })
    if (!res.ok) console.error(`syncOreEffettive error: ${res.status}`)
  }
}

export type { Session, User }
