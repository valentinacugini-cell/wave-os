const SUPABASE_URL = 'https://ckkdrtzyowhbddpoziha.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2RydHp5b3doYmRkcG96aWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzU2MzcsImV4cCI6MjA5ODA1MTYzN30.0BSBbjKmrdGtmtr2N2RCIQUZDxGkHObcWYguoarFC2I'

async function sb(table: string, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    }
  })
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function sbPost(table: string, data: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function sbPatch(table: string, id: string, data: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`)
}

export async function sbDelete(table: string, id: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  })
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`)
}

export async function loadSeed() {
  const [team, clienti, progetti, tasks, scadenze, contatti, noteRinnovo] = await Promise.all([
    sb('team', 'select=*&order=tipo,nome'),
    sb('clienti', 'select=*&order=nome'),
    sb('progetti', 'select=*&order=nome'),
    sb('tasks', 'select=*&order=data_fine'),
    sb('scadenze', 'select=*&order=data'),
    sb('contatti', 'select=*'),
    sb('note_rinnovo', 'select=*'),
  ])

  const mesi_label = ['Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

  const teamNorm = team.map((p: any) => ({
    id: p.id, nome: p.nome, ruolo: p.ruolo, tipo: p.tipo, colore: p.colore,
    capacita_mensile: p.capacita_mensile ?? [],
  }))

  const capacita = teamNorm
    .filter((p: any) => p.tipo === 'operativo' && p.capacita_mensile?.length > 0)
    .map((p: any) => ({ persona: p.id, valori: p.capacita_mensile }))

  const ore_pianificate = teamNorm
    .filter((p: any) => p.tipo === 'operativo')
    .map((p: any) => ({ persona: p.id, valori: new Array(7).fill(0) }))

  // Assicuro che tutti gli array siano sempre array validi
  const safeSeed = {
    team: teamNorm ?? [],
    clienti: (clienti ?? []).map((c: any) => ({
      id: c.id, nome: c.nome, stato: c.stato, tipo: c.tipo,
      tipo_contratto: c.tipo_contratto, referente: c.referente, commerciale: c.commerciale,
      scadenza_contratto: c.scadenza_contratto, rinnovo_previsto: c.rinnovo_previsto,
      lead_obiettivo: c.lead_obiettivo, lead_raccolte: c.lead_raccolte,
      ore_effettive_ytd_2026: c.ore_effettive_ytd_2026 ?? 0,
      ore_effettive_mesi_2026: c.ore_effettive_mesi_2026 ?? new Array(12).fill(0),
    })),
    progetti: progetti.map((p: any) => ({
      id: p.id, cliente: p.cliente, nome: p.nome, anno: p.anno,
      ore_contratto: p.ore_contratto ?? 0, stato: p.stato,
      data_inizio: p.data_inizio, data_fine: p.data_fine,
    })),
    tasks: tasks.map((t: any) => ({
      id: t.id, cliente: t.cliente, progetto_id: t.progetto_id,
      area: t.area ?? '', milestone: t.milestone, titolo: t.titolo,
      assegnatari: t.assegnatari ?? [], ore_stimate: t.ore_stimate ?? 0,
      data_inizio: t.data_inizio, data_fine: t.data_fine,
      priorita: t.priorita ?? 'media', stato: t.stato ?? 'da_fare',
      ricorrente: t.ricorrente ?? false, frequenza: t.frequenza, note: t.note,
    })),
    scadenze: scadenze.map((s: any) => ({
      id: s.id, cliente: s.cliente, progetto_id: s.progetto_id,
      titolo: s.titolo, tipo: s.tipo, urgenza: s.urgenza ?? 'normale',
      data: s.data, stato: s.stato ?? 'aperto', referente: s.referente, note: s.note,
    })),
    contatti: contatti.map((c: any) => ({
      id: c.id, cliente: c.cliente, nome: c.nome, ruolo: c.ruolo,
      email: c.email, telefono: c.telefono, principale: c.principale ?? false,
    })),
    note_rinnovo: noteRinnovo.map((n: any) => ({ cliente: n.cliente, note: n.note })),
    allocazioni: [],
    mesi_label: mesi_label ?? ['Giu','Lug','Ago','Set','Ott','Nov','Dic'],
    capacita: capacita ?? [],
    ore_pianificate: ore_pianificate ?? [],
  }

  // Patch difensiva: garantisce che ogni cliente abbia gli array necessari
  safeSeed.clienti = safeSeed.clienti.map((c: any) => ({
    ...c,
    ore_effettive_mesi_2026: c.ore_effettive_mesi_2026 ?? new Array(12).fill(0),
  }))
  safeSeed.team = safeSeed.team.map((p: any) => ({
    ...p,
    capacita_mensile: p.capacita_mensile ?? [],
  }))

  return safeSeed
}
