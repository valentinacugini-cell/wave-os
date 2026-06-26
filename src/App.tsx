import React, { useState, useMemo } from 'react'
import seedData from './data/seed.json'
import { loadSeed } from './lib/supabase'
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
  const [seed, setSeed] = React.useState<any>(seedData)
  const [loading, setLoading] = React.useState(true)
  const [dbError, setDbError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadSeed()
      .then(data => { setSeed(data); setLoading(false) })
      .catch(err => { console.error('Supabase:', err); setDbError(err.message); setLoading(false) })
  }, [])

  const [currentView, setCurrentView] = useState<View>('home')
  const [currentUserId, setCurrentUserId] = useState<string>('valentina')
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null)

  const currentUser = useMemo(
    () => seed.team.find((p: any) => p.id === currentUserId) ?? seed.team[0],
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

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid #7DF5DF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#666', fontSize: 14 }}>Caricamento dati...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (dbError) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <p style={{ color: '#E24B4A', fontSize: 14, fontWeight: 500 }}>Errore connessione database</p>
      <p style={{ color: '#999', fontSize: 12 }}>{dbError}</p>
      <p style={{ color: '#999', fontSize: 12 }}>Carico i dati di esempio locali...</p>
    </div>
  )

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
