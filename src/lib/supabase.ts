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

export async function sbUpsert(table: string, data: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
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
    .map((p: any) => ({ persona: p.id, valori: Array.isArray(p.ore_pianificate) && p.ore_pianificate.length > 0 ? p.ore_pianificate : new Array(7).fill(0) }))

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

  // Patch difensiva completa
  safeSeed.clienti = (safeSeed.clienti ?? []).map((c: any) => ({
    ...c,
    ore_effettive_mesi_2026: Array.isArray(c.ore_effettive_mesi_2026) ? c.ore_effettive_mesi_2026 : new Array(12).fill(0),
  }))
  safeSeed.team = (safeSeed.team ?? []).map((p: any) => ({
    ...p,
    capacita_mensile: Array.isArray(p.capacita_mensile) ? p.capacita_mensile : [],
  }))
  safeSeed.tasks = (safeSeed.tasks ?? []).map((t: any) => ({
    ...t,
    assegnatari: Array.isArray(t.assegnatari) ? t.assegnatari : [],
    priorita: t.priorita ?? 'media',
    stato: t.stato ?? 'da_fare',
    ore_stimate: t.ore_stimate ?? 0,
  }))
  ;(safeSeed as any).scadenze = Array.isArray(safeSeed.scadenze) ? safeSeed.scadenze : []
  ;(safeSeed as any).progetti = Array.isArray(safeSeed.progetti) ? safeSeed.progetti : []
  ;(safeSeed as any).contatti = Array.isArray(safeSeed.contatti) ? safeSeed.contatti : []
  ;(safeSeed as any).allocazioni = []
  ;(safeSeed as any).ore_consuntivate = []
  ;(safeSeed as any).capacita = Array.isArray(safeSeed.capacita) ? safeSeed.capacita : []
  ;(safeSeed as any).ore_pianificate = Array.isArray(safeSeed.ore_pianificate) ? safeSeed.ore_pianificate : []

  return safeSeed
}

// ── Lettura ore effettive dal timesheet Google Sheets ─────────────────────

const SHEET_ID = '1UUIohuV202zvnB909QrAJyrLpqDQwsLkj16vYiZvgak'

// Mappa nome cliente nel timesheet → id Supabase
const TIMESHEET_CLIENTE_MAP: Record<string, string> = {
  'Accuracy': 'accuracy', 'AGRIBRIANZA': 'agribrianza', 'Alimeco': 'alimeco',
  'ASILETTO': 'asiletto', 'BEFLUIDICA': 'befluidica', 'CARBOTERMO': 'carbotermo',
  'CDO COMO': 'cdo_como', 'CDO MILANO': 'cdo_milano', 'CDO MONZA E BRIANZA': 'cdo_monza',
  'CL SCRITTI': 'cl_scritti', 'COGEFIM': 'cogefim', "COLLEZIONI D'ARTE": 'collezioni_arte',
  'COMUNE DI SONDRIO': 'comune_sondrio', 'CTL GROUP': 'ctl_group', 'DIEMME': 'diemme',
  'FERRARI': 'ferrari', 'FIU': 'fiu', 'FOTORENT': 'fotorent', 'G&B': 'gb_group',
  'GIARDINIA': 'giardinia', 'GRUPPODIGIT': 'gruppodigit', 'INFOR-MA': 'informa',
  'MAINARDI SISTEMI': 'mainardi', 'MECH-I-TRONIC': 'mech_i_tronic', 'MIL SERVICE': 'mil_service',
  'NASTRI BRIZZOLARI': 'brizzolari', 'NATURAL CLIMA': 'natural_clima', 'NEW': 'new_srl',
  'OLTRE IMPACT': 'oltre_impact', 'ON ENERGY': 'on_energy', 'RB': 'rb',
  'RL - VIRGONET': 'virgonet', 'SCS': 'scs', 'Shoptime': 'shoptime',
  'SILVAUTO': 'silvauto', 'SOGEMA': 'sogema', 'TECNODATA': 'tecnodata',
  'TELPRO': 'telpro', 'TOP FILM': 'topfilm', 'TRECCANI': 'treccani',
  'WIC': 'wic', 'CDO': 'cdo',
}

function safeNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export async function fetchOreEffettive(): Promise<Record<string, { ytd: number; mesi: number[] }>> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Controllo`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const csv = await res.text()

    // Parse CSV manuale
    const rows = csv.split('\n').map(line => {
      const cells: string[] = []
      let inQuote = false, cell = ''
      for (const ch of line) {
        if (ch === '"') { inQuote = !inQuote }
        else if (ch === ',' && !inQuote) { cells.push(cell.trim()); cell = '' }
        else { cell += ch }
      }
      cells.push(cell.trim())
      return cells
    })

    // Trova riga intestazione per localizzare colonne mesi
    // Struttura attesa: col 0=nome, col 44=YTD, col 46-57=GEN-DIC
    const result: Record<string, { ytd: number; mesi: number[] }> = {}

    for (const row of rows) {
      const nome = row[0]?.replace(/^"|"$/g, '').trim() ?? ''
      if (!nome || !TIMESHEET_CLIENTE_MAP[nome]) continue

      const clienteId = TIMESHEET_CLIENTE_MAP[nome]
      const ytd = safeNum(row[44])
      const mesi = Array.from({ length: 12 }, (_, i) => safeNum(row[46 + i]))

      result[clienteId] = { ytd, mesi }
    }

    return result
  } catch (e) {
    console.error('fetchOreEffettive:', e)
    return {}
  }
}

export async function syncOreEffettive(): Promise<number> {
  const ore = await fetchOreEffettive()
  let aggiornati = 0

  for (const [clienteId, dati] of Object.entries(ore)) {
    if (dati.ytd === 0 && dati.mesi.every(v => v === 0)) continue
    try {
      await sbPatch('clienti', clienteId, {
        ore_effettive_ytd_2026: dati.ytd,
        ore_effettive_mesi_2026: dati.mesi,
      })
      aggiornati++
    } catch (e) {
      console.error(`syncOreEffettive ${clienteId}:`, e)
    }
  }

  return aggiornati
}
