import React, { useState, useMemo } from 'react'
import seedData from './data/seed.json'
import { Seed, Persona, View } from './types'
import { TaskProvider } from './context/TaskContext'
import { ClienteProvider } from './context/ClienteContext'
import Sidebar from './components/Sidebar'
import HomeView from './views/HomeView'
import CaricoView from './views/CaricoView'
import ScadenzeView from './views/ScadenzeView'
import OperativitaView from './views/OperativitaView'
import SchedaCliente from './views/SchedaCliente'
import ForecastView from './views/ForecastView'

const seed = seedData as unknown as Seed

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home')
  const [currentUserId, setCurrentUserId] = useState<string>('valentina')
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null)

  const currentUser = useMemo(
    () => seed.team.find(p => p.id === currentUserId) ?? seed.team[0],
    [currentUserId]
  )

  function handleClienteClick(id: string) {
    setSelectedCliente(id)
    setCurrentView('cliente')
  }

  function handleBack() {
    setSelectedCliente(null)
    setCurrentView('home')
  }

  return (
    <ClienteProvider>
      <TaskProvider>
      <div className="flex min-h-screen" style={{ backgroundColor: '#F8F9FA' }}>
        <Sidebar
          currentView={currentView}
          onViewChange={(v) => { setCurrentView(v); if (v !== 'cliente') setSelectedCliente(null) }}
          currentUser={currentUser}
          team={seed.team}
          onUserChange={setCurrentUserId}
        />
        <main className="flex-1 overflow-auto" style={{ marginLeft: 240 }}>
          <div className="max-w-6xl mx-auto px-8 py-8">
            {currentView === 'home' && <HomeView seed={seed} currentUser={currentUser} onClienteClick={handleClienteClick} />}
            {currentView === 'carico' && <CaricoView seed={seed} />}
            {currentView === 'scadenze' && <ScadenzeView seed={seed} onClienteClick={handleClienteClick} />}
            {currentView === 'operativita' && <OperativitaView seed={seed} onClienteClick={handleClienteClick} />}
            {currentView === 'cliente' && selectedCliente && <SchedaCliente clienteId={selectedCliente} seed={seed} onBack={handleBack} />}
            {currentView === 'forecast' && <ForecastView />}
          </div>
        </main>
      </div>
    </TaskProvider>
    </ClienteProvider>
  )
}
