import { AlertLevel, Cliente } from './types'

// Data di riferimento fissa per la demo — aggiornare per produzione
export const TODAY = new Date('2026-06-24')

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
