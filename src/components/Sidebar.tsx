import React from 'react'
import { View, Persona } from '../types'

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'home',         label: 'Clienti attivi', icon: '⊞' },
  { id: 'operativita',  label: 'Operatività',    icon: '◈' },
  { id: 'carico',       label: 'Carico Team',    icon: '◫' },
  { id: 'scadenze',     label: 'Scadenze',       icon: '◷' },
]

interface SidebarProps {
  currentView: View
  onViewChange: (v: View) => void
  currentUser: Persona
  team: Persona[]
  onUserChange: (id: string) => void
}

export default function Sidebar({ currentView, onViewChange, currentUser, team, onUserChange }: SidebarProps) {
  const activeView = currentView === 'cliente' ? 'home' : currentView

  return (
    <div className="fixed top-0 left-0 h-screen flex flex-col"
      style={{ width: 240, backgroundColor: '#1A1A2E', borderRight: '1px solid #252545' }}>
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-1 rounded"
            style={{ backgroundColor: '#7DF5DF', color: '#1A1A2E', letterSpacing: '0.05em' }}>W</span>
          <span className="text-white font-semibold text-base tracking-wide">Wave OS</span>
        </div>
        <p className="text-white/30 text-xs mt-1 ml-8">Gestione operativa</p>
      </div>

      <nav className="flex-1 px-3 py-4">
        <p className="text-white/30 text-xs font-medium uppercase tracking-widest px-3 mb-2">Viste</p>
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => onViewChange(item.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5"
            style={{
              backgroundColor: activeView === item.id ? '#252545' : 'transparent',
              color: activeView === item.id ? '#7DF5DF' : 'rgba(255,255,255,0.6)',
            }}>
            <span className="text-base w-5 text-center">{item.icon}</span>
            {item.label}
            {activeView === item.id && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#7DF5DF' }} />
            )}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-white/30 text-xs font-medium uppercase tracking-widest mb-2 px-1">Visualizza come</p>
        <div className="relative">
          <select value={currentUser.id} onChange={e => onUserChange(e.target.value)}
            className="w-full appearance-none text-sm rounded-lg px-3 py-2.5 pr-8 cursor-pointer"
            style={{ backgroundColor: '#252545', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}>
            {team.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
            style={{ color: 'rgba(255,255,255,0.4)' }}>▾</span>
        </div>
        <div className="mt-2 px-1">
          <span className="text-xs px-2 py-0.5 rounded"
            style={{
              backgroundColor: currentUser.tipo === 'operativo' ? '#1E3A3A' : '#2A2A1A',
              color: currentUser.tipo === 'operativo' ? '#7DF5DF' : '#F9A825',
            }}>
            {currentUser.tipo === 'operativo' ? 'Operativo' : 'Commerciale'} · {currentUser.ruolo}
          </span>
        </div>
      </div>
    </div>
  )
}