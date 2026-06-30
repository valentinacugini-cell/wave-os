import { AlertLevel, Cliente, Task } from './types'

// Data odierna, normalizzata a mezzanotte UTC come le date "solo giorno" (YYYY-MM-DD)
// gestite da parseDate, così i confronti/calcoli di giorni restano coerenti
// indipendentemente dall'ora e dal fuso orario in cui viene aperta l'app.
function oggiDateOnly(): Date {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return new Date(`${yyyy}-${mm}-${dd}`)
}

export const TODAY = oggiDateOnly()

export function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = parseDate(dateStr)
  if (!d) return '—'
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = parseDate(dateStr)
  if (!d) return '—'
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = parseDate(dateStr)
  if (!d) return null
  const diff = d.getTime() - TODAY.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getAlertLevel(cliente: Cliente): AlertLevel {
  if (cliente.stato === 'in_attesa') return 'in_attesa'

  const dates = [cliente.scadenza_contratto, cliente.rinnovo_previsto]
    .filter(Boolean)
    .map(d => daysUntil(d))
    .filter((d): d is number => d !== null)

  if (dates.length === 0) return 'ok'
  const minDays = Math.min(...dates)

  if (minDays <= 30) return 'critica'
  if (minDays <= 90) return 'attenzione'
  return 'ok'
}

export function getProssimaScadenza(cliente: Cliente): string | null {
  const candidates = [cliente.rinnovo_previsto, cliente.scadenza_contratto]
    .filter(Boolean) as string[]

  if (candidates.length === 0) return null

  return candidates.reduce((closest, current) => {
    const dC = daysUntil(closest)
    const dCurr = daysUntil(current)
    if (dC === null) return current
    if (dCurr === null) return closest
    return dCurr < dC ? current : closest
  })
}

export function alertLevelOrder(level: AlertLevel): number {
  switch (level) {
    case 'critica': return 0
    case 'attenzione': return 1
    case 'in_attesa': return 2
    case 'ok': return 3
  }
}

// Indice del mese corrente nel piano (0=giu, 1=lug, ...)
export const MESI = ['giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
export const MESE_CORRENTE_IDX = 0 // giugno 2026

function giorniInclusivi(a: Date, b: Date): number {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1)
}

// Distribuisce le ore stimate di un task sul periodo [periodoStart, periodoEnd]
// in proporzione ai giorni di sovrapposizione con la durata del task.
// Usata come unica sorgente di verità per "ore pianificate/allocate" derivate dai task,
// così Carico, Operatività e Scheda cliente restano coerenti tra loro.
export function oreTaskNelPeriodo(
  task: Pick<Task, 'ore_stimate' | 'data_inizio' | 'data_fine'>,
  periodoStart: Date,
  periodoEnd: Date
): number {
  if (!task.ore_stimate || task.ore_stimate <= 0) return 0
  const tStart = parseDate(task.data_inizio) ?? parseDate(task.data_fine)
  const tEnd = parseDate(task.data_fine) ?? tStart
  if (!tStart || !tEnd) return 0
  if (tStart > periodoEnd || tEnd < periodoStart) return 0

  const durataTask = giorniInclusivi(tStart, tEnd)
  const overlapStart = tStart < periodoStart ? periodoStart : tStart
  const overlapEnd = tEnd > periodoEnd ? periodoEnd : tEnd
  const overlapGiorni = giorniInclusivi(overlapStart, overlapEnd)

  return (task.ore_stimate * overlapGiorni) / durataTask
}
