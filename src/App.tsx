import React, { useState, useMemo } from 'react'
import seedData from './data/seed.json'
import { loadSeed, syncOreEffettive } from './lib/supabase'
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


class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string | null}> {
  constructor(props: any) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message + '\n' + error.stack }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', fontSize: 12 }}>
          <p style={{ color: '#E24B4A', fontWeight: 600, marginBottom: 8 }}>Errore React — dettagli:</p>
          <pre style={{ background: '#FFF0F0', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', color: '#333' }}>
            {this.state.error}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

function normalizeSeed(raw: any): any {
  const e: any[] = []
  const arr = (v: any) => Array.isArray(v) ? v : e
  return {
    ...raw,
    scadenze:        arr(raw?.scadenze),
    progetti:        arr(raw?.progetti),
    contatti:        arr(raw?.contatti),
    allocazioni:     arr(raw?.allocazioni),
    note_rinnovo:    arr(raw?.note_rinnovo),
    capacita:        arr(raw?.capacita),
    ore_pianificate: arr(raw?.ore_pianificate),
    ore_consuntivate: Array.isArray(raw?.ore_consuntivate) ? raw.ore_consuntivate : [],
    mesi_label:      arr(raw?.mesi_label).length > 0 ? raw.mesi_label : ['Giu','Lug','Ago','Set','Ott','Nov','Dic'],
    team: arr(raw?.team).map((p: any) => ({
      ...p,
      capacita_mensile: Array.isArray(p.capacita_mensile) ? p.capacita_mensile : [],
    })),
    clienti: arr(raw?.clienti).map((c: any) => ({
      ...c,
      ore_effettive_mesi_2026: Array.isArray(c.ore_effettive_mesi_2026) ? c.ore_effettive_mesi_2026 : new Array(12).fill(0),
    })),
    tasks: arr(raw?.tasks).map((t: any) => ({
      ...t,
      assegnatari: Array.isArray(t.assegnatari) ? t.assegnatari : [],
      priorita: t.priorita ?? 'media',
      stato: t.stato ?? 'da_fare',
      ore_stimate: t.ore_stimate ?? 0,
    })),
  }
}

export default function App() {
  const [seed, setSeed] = React.useState<any>(normalizeSeed(seedData))
  const [loading, setLoading] = React.useState(true)
  const [dbError, setDbError] = React.useState<string | null>(null)
  const [syncing, setSyncing] = React.useState(false)
  const [syncMsg, setSyncMsg] = React.useState<string | null>(null)
  const [exporting, setExporting] = React.useState(false)
  const [exportMsg, setExportMsg] = React.useState<string | null>(null)

  async function handleExportBackup() {
    setExporting(true)
    setExportMsg(null)
    try {
      const SUPABASE_URL = 'https://ckkdrtzyowhbddpoziha.supabase.co'
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2RydHp5b3doYmRkcG96aWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzU2MzcsImV4cCI6MjA5ODA1MTYzN30.0BSBbjKmrdGtmtr2N2RCIQUZDxGkHObcWYguoarFC2I'
      const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      const tables = ['team', 'clienti', 'progetti', 'tasks', 'scadenze', 'contatti', 'note_rinnovo']
      const backup: any = { exported_at: new Date().toISOString(), version: '1.0' }
      for (const table of tables) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers })
        backup[table] = await res.json()
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wave-os-backup-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      const totTask = backup.tasks?.length ?? 0
      const totClienti = backup.clienti?.length ?? 0
      setExportMsg(`Backup scaricato — ${totClienti} clienti, ${totTask} task`)
    } catch(e: any) {
      setExportMsg('Errore: ' + e.message)
    }
    setExporting(false)
    setTimeout(() => setExportMsg(null), 5000)
  }

  async function handleSyncTimesheet() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const n = await syncOreEffettive()
      // Ricarica i dati aggiornati
      const data = await loadSeed()
      setSeed(normalizeSeed(data))
      setSyncMsg(`Aggiornate ore per ${n} clienti`)
    } catch(e: any) {
      setSyncMsg('Errore: ' + e.message)
    }
    setSyncing(false)
    setTimeout(() => setSyncMsg(null), 4000)
  }

  React.useEffect(() => {
    loadSeed()
      .then(data => { setSeed(normalizeSeed(data)); setLoading(false) })
      .catch(err => { console.error('Supabase:', err); setDbError(err.message); setLoading(false) })
  }, [])

  const [currentView, setCurrentView] = useState<View>('home')
  const [currentUserId, setCurrentUserId] = useState<string>('valentina')
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null)

  const currentUser = useMemo(
    () => seed.team.find((p: any) => p.id === currentUserId) ?? seed.team[0],
    [currentUserId, seed.team]
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
    <ErrorBoundary>
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
          {currentView === 'impostazioni' && (
            <div className="max-w-lg">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Impostazioni</h2>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-900 mb-1">Sincronizza ore da timesheet</p>
                <p className="text-xs text-gray-400 mb-4">Legge le ore effettive aggiornate dal file Google Sheets del team e aggiorna il database.</p>
                <div className="flex items-center gap-3">
                  <button onClick={handleSyncTimesheet} disabled={syncing}
                    className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors"
                    style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
                    {syncing ? 'Sincronizzazione...' : '↻ Aggiorna ore timesheet'}
                  </button>
                  {syncMsg && <p className="text-xs" style={{ color: syncMsg.startsWith('Errore') ? '#E24B4A' : '#1D9E75' }}>{syncMsg}</p>}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Esporta backup completo</p>
                <p className="text-xs text-gray-400 mb-4">Scarica tutti i dati in formato JSON. Conserva il file come backup locale indipendente da Supabase.</p>
                <div className="flex items-center gap-3">
                  <button onClick={handleExportBackup} disabled={exporting}
                    className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors"
                    style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
                    {exporting ? 'Esportazione...' : '↓ Esporta backup'}
                  </button>
                  {exportMsg && <p className="text-xs" style={{ color: exportMsg.startsWith('Errore') ? '#E24B4A' : '#1D9E75' }}>{exportMsg}</p>}
                </div>
              </div>

            </div>
          )}
              </div>
            </main>
          </div>
        </TaskProvider>
      </ClienteProvider>
    </ErrorBoundary>
  )
}
