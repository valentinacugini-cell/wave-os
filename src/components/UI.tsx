import React from 'react'
import { ClienteTipo, ClienteStato, ScadenzaTipo, AlertLevel } from '../types'

// ── Badge tipo cliente ──────────────────────────────────────────────────────
const tipoConfig: Record<ClienteTipo, { label: string; bg: string; text: string }> = {
  nuovo: { label: 'Nuovo', bg: '#E0FDF8', text: '#0D9488' },
  progetto_complesso: { label: 'Progetto', bg: '#E3F0FF', text: '#2563EB' },
  gestione_continuativa: { label: 'Continuativo', bg: '#F3F4F6', text: '#6B7280' },
}

export function BadgeTipo({ tipo }: { tipo: ClienteTipo }) {
  const cfg = tipoConfig[tipo]
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  )
}

// ── Badge stato cliente ─────────────────────────────────────────────────────
export function BadgeStato({ stato }: { stato: ClienteStato }) {
  const cfg: Record<ClienteStato, { label: string; bg: string; text: string }> = {
    attivo: { label: 'Attivo', bg: '#E8F5E9', text: '#2E7D32' },
    in_attesa: { label: 'In attesa', bg: '#FFF8E1', text: '#F57F17' },
    pausa: { label: 'Pausa', bg: '#F3F4F6', text: '#6B7280' },
    concluso: { label: 'Concluso', bg: '#FEF2F2', text: '#B91C1C' },
  }
  const c = cfg[stato]
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}>
      {c.label}
    </span>
  )
}

// ── Badge alert ─────────────────────────────────────────────────────────────
export function BadgeAlert({ level, daysLabel }: { level: AlertLevel; daysLabel?: string }) {
  if (level === 'ok') {
    return <span className="text-xs text-wave-green flex items-center gap-1">✓ OK</span>
  }
  if (level === 'in_attesa') {
    return <span className="text-xs text-wave-gray flex items-center gap-1">⏸ In attesa</span>
  }
  if (level === 'critica') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
        style={{ backgroundColor: '#FFEBEE', color: '#C62828' }}>
        🔴 Critica {daysLabel && <span className="font-normal">({daysLabel})</span>}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: '#FFFDE7', color: '#F57F17' }}>
      🟡 Attenzione {daysLabel && <span className="font-normal">({daysLabel})</span>}
    </span>
  )
}

// ── Badge tipo scadenza ─────────────────────────────────────────────────────
const scadenzaTipoConfig: Record<ScadenzaTipo, { label: string; bg: string; text: string; dot: string }> = {
  rinnovo:         { label: 'Rinnovo',         bg: '#FFF0EB', text: '#C2410C', dot: '#E07B54' },
  rilascio:        { label: 'Rilascio',         bg: '#E3F0FF', text: '#1D4ED8', dot: '#4F86C6' },
  riunione_cliente:{ label: 'Riunione cliente', bg: '#E8F5E9', text: '#15803D', dot: '#7DC67D' },
  interno:         { label: 'Interno',          bg: '#F3F4F6', text: '#4B5563', dot: '#9CA3AF' },
  checkpoint:      { label: 'Checkpoint',       bg: '#F5F3FF', text: '#6D28D9', dot: '#A67DC6' },
}

export function BadgeScadenzaTipo({ tipo }: { tipo: ScadenzaTipo }) {
  const cfg = scadenzaTipoConfig[tipo]
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

// ── Stat card ───────────────────────────────────────────────────────────────
export function StatCard({
  label, value, sub, accent
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-wave-grayLight p-4 flex flex-col gap-1"
      style={{ borderLeft: accent ? `4px solid ${accent}` : undefined }}>
      <span className="text-xs text-wave-gray font-medium uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-wave-dark">{value}</span>
      {sub && <span className="text-xs text-wave-gray">{sub}</span>}
    </div>
  )
}

// ── Sezione header ──────────────────────────────────────────────────────────
export function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <h1 className="text-xl font-semibold text-wave-dark">{title}</h1>
      {count !== undefined && (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: '#E0FDF8', color: '#0D9488' }}>
          {count}
        </span>
      )}
    </div>
  )
}

// ── Tabs ────────────────────────────────────────────────────────────────────
export function Tabs({
  tabs, active, onChange
}: {
  tabs: { id: string; label: string; count?: number }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex gap-0 border-b border-wave-grayLight mb-6">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            active === tab.id
              ? 'border-wave-tealDark text-wave-dark'
              : 'border-transparent text-wave-gray hover:text-wave-dark'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
              active === tab.id ? 'bg-wave-teal text-wave-dark' : 'bg-gray-100 text-wave-gray'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────────
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-wave-gray">
      <span className="text-4xl mb-3">○</span>
      <span className="text-sm">{message}</span>
    </div>
  )
}
