import React, { useState, useEffect, useMemo } from 'react'
import { Seed, Task } from '../types'

const SUPABASE_URL = 'https://ckkdrtzyowhbddpoziha.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2RydHp5b3doYmRkcG96aWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzU2MzcsImV4cCI6MjA5ODA1MTYzN30.0BSBbjKmrdGtmtr2N2RCIQUZDxGkHObcWYguoarFC2I'
const SB_HEADERS: Record<string,string> = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }

const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
const ANNO_CORRENTE = new Date().getFullYear()

const TIPO_COLORS: Record<string, string> = {
  rilascio: '#4F86C6', riunione: '#1D9E75', golive: '#7DF5DF',
  rinnovo: '#E07B54', riunione_cliente: '#1D9E75', altro: '#888780',
}
const PROSPECT_COLORS = ['#A67DC6','#E07B54','#4F86C6','#F9A825','#E53935','#639922','#1D9E75']

interface ForecastProgetto {
  id: string; nome: string; referente?: string
  data_inizio: string|null; data_fine: string|null
  ore_mensili: number[]; colore: string; note?: string
}
interface ForecastMilestone {
  id: string; forecast_id: string; titolo: string; data: string; tipo: string
}

export default function ForecastView({ seed }: { seed: Seed }) {
  const [prospects, setProspects] = useState<ForecastProgetto[]>([])
  const [milestones, setMilestones] = useState<ForecastMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [annoVista, setAnnoVista] = useState(ANNO_CORRENTE)

  useEffect(() => {
    async function load() {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/forecast_progetti?select=*&order=data_inizio`, { headers: SB_HEADERS }),
          fetch(`${SUPABASE_URL}/rest/v1/forecast_milestone?select=*`, { headers: SB_HEADERS }),
        ])
        const [p, m] = await Promise.all([r1.json(), r2.json()])
        setProspects(Array.isArray(p) ? p : [])
        setMilestones(Array.isArray(m) ? m : [])
      } catch(e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  const oreConfermatePerProgetto = useMemo(() => {
    const result: Record<string, number[]> = {}
    const progettiAttivi = (seed.progetti ?? []).filter(p => p.stato === 'attivo')
    for (const prog of progettiAttivi) {
      const taskProg = (seed.tasks ?? []).filter((t: Task) => t.progetto_id === prog.id)
      const oreMesi = new Array(12).fill(0)
      for (const t of taskProg) {
        if (t.data_fine) {
          const d = new Date(t.data_fine)
          if (d.getFullYear() === annoVista) oreMesi[d.getMonth()] += Number(t.ore_stimate) || 0
        }
      }
      result[prog.id] = oreMesi
    }
    return result
  }, [seed.progetti, seed.tasks, annoVista])

  const milestoneConfermate = useMemo(() =>
    (seed.scadenze ?? []).filter((s: any) => {
      if (!s.data) return false
      const d = new Date(s.data)
      return d.getFullYear() === annoVista && ['rilascio','riunione_cliente','riunione'].includes(s.tipo)
    }), [seed.scadenze, annoVista])

  const maxOreGlobale = useMemo(() => {
    let max = 0
    for (const mesi of Object.values(oreConfermatePerProgetto))
      for (const v of mesi) if (v > max) max = v
    for (const p of prospects)
      for (const v of (p.ore_mensili || [])) if (v > max) max = v
    return max || 1
  }, [oreConfermatePerProgetto, prospects])

  function intensityBg(ore: number, max: number, colore: string, prospect = false): string {
    if (ore === 0) return 'transparent'
    const pct = Math.min(ore / max, 1)
    const alpha = Math.round((prospect ? pct * 0.45 : pct * 0.82) * 255).toString(16).padStart(2,'0')
    return colore + alpha
  }

  function meseAnno(dataStr: string, anno: number): number|null {
    const d = new Date(dataStr)
    return d.getFullYear() === anno ? d.getMonth() : null
  }

  async function handleDeleteProspect(id: string) {
    if (!confirm('Eliminare questo prospect?')) return
    await fetch(`${SUPABASE_URL}/rest/v1/forecast_progetti?id=eq.${id}`, { method:'DELETE', headers: SB_HEADERS })
    setProspects(prev => prev.filter(p => p.id !== id))
    setMilestones(prev => prev.filter(m => m.forecast_id !== id))
  }

  const progettiAttivi = (seed.progetti ?? []).filter(p => p.stato === 'attivo')

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-sm text-gray-400">Caricamento...</p></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Forecast</h1>
          <p className="text-xs text-gray-400 mt-0.5">Densità operativa per progetto — confermati e previsionali</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setAnnoVista(a => a-1)} className="w-7 h-7 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 text-sm">‹</button>
            <span className="text-sm font-semibold text-gray-900 w-12 text-center">{annoVista}</span>
            <button onClick={() => setAnnoVista(a => a+1)} className="w-7 h-7 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 text-sm">›</button>
          </div>
          <button onClick={() => setShowForm(true)}
            className="text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
            + Prospect
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-400 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-3 rounded" style={{ background: 'linear-gradient(to right,#7DF5DF22,#7DF5DFcc)' }} />Confermato
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-3 rounded border-dashed border" style={{ borderColor:'#A67DC6', background:'linear-gradient(to right,#A67DC611,#A67DC655)' }} />Previsionale
        </div>
        {Object.entries(TIPO_COLORS).filter(([k]) => k!=='altro' && k!=='rinnovo' && k!=='riunione_cliente').map(([tipo, col]) => (
          <div key={tipo} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rotate-45 inline-block flex-shrink-0" style={{ background: col }} />
            {tipo.charAt(0).toUpperCase()+tipo.slice(1)}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header mesi */}
        <div className="flex border-b border-gray-200" style={{ paddingLeft:200 }}>
          {MESI.map(m => (
            <div key={m} className="flex-1 text-center text-xs font-medium text-gray-400 py-2.5">{m}</div>
          ))}
        </div>

        {/* Confermati */}
        {progettiAttivi.length > 0 && (
          <>
            <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
              Confermati ({progettiAttivi.length})
            </div>
            {progettiAttivi.map(prog => {
              const cliente = (seed.clienti ?? []).find((c: any) => c.id === prog.cliente)
              const referente = (seed.team ?? []).find((t: any) => t.id === cliente?.referente)
              const colore = referente?.colore || '#7DF5DF'
              const oreMesi = oreConfermatePerProgetto[prog.id] || new Array(12).fill(0)
              const msProj = milestoneConfermate.filter((s: any) => s.cliente === prog.cliente)
              const totOre = oreMesi.reduce((a: number, b: number) => a+b, 0)
              if (totOre === 0 && msProj.length === 0) return null
              return (
                <div key={prog.id} className="flex items-stretch border-b border-gray-100 hover:bg-gray-50 transition-colors" style={{ minHeight:44 }}>
                  <div className="flex items-center gap-2 px-4 border-r border-gray-100" style={{ width:200, flexShrink:0 }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colore }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{cliente?.nome || prog.cliente}</p>
                      <p className="text-xs text-gray-400 truncate">{prog.nome}</p>
                    </div>
                  </div>
                  <div className="flex flex-1">
                    {MESI.map((_, mi) => {
                      const ore = oreMesi[mi] || 0
                      const ms = msProj.filter((s: any) => meseAnno(s.data, annoVista) === mi)
                      return (
                        <div key={mi} className="flex-1 relative flex items-center justify-center border-r border-gray-50 last:border-0"
                          style={{ background: intensityBg(ore, maxOreGlobale, colore), minHeight:44 }}>
                          {ore > 0 && <span className="text-xs font-medium" style={{ color: colore, mixBlendMode:'multiply' }}>{Math.round(ore)}</span>}
                          {ms.map((s: any) => (
                            <div key={s.id} className="absolute top-1 right-1 group z-10">
                              <div className="w-2 h-2 rotate-45" style={{ background: TIPO_COLORS[s.tipo]||'#888' }} />
                              <div className="absolute bottom-full right-0 mb-1 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20">{s.titolo}</div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Previsionali */}
        {prospects.length > 0 && (
          <>
            <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide border-b border-t border-gray-200"
              style={{ background:'#F5F3FF', color:'#7C3AED' }}>
              Prospect / Previsionali ({prospects.length})
            </div>
            {prospects.map(p => {
              const oreMesi = p.ore_mensili || new Array(12).fill(0)
              const msPros = milestones.filter(m => m.forecast_id === p.id)
              return (
                <div key={p.id} className="flex items-stretch border-b border-dashed border-gray-200 hover:bg-purple-50 transition-colors group/row" style={{ minHeight:44 }}>
                  <div className="flex items-center gap-2 px-4 border-r border-dashed border-gray-200" style={{ width:200, flexShrink:0 }}>
                    <div className="w-2 h-2 rounded-full border-2 flex-shrink-0" style={{ borderColor: p.colore, background: p.colore+'33' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate" style={{ color: p.colore }}>{p.nome}</p>
                      {p.referente && <p className="text-xs text-gray-400 truncate">{p.referente}</p>}
                    </div>
                    <button onClick={() => handleDeleteProspect(p.id)}
                      className="opacity-0 group-hover/row:opacity-100 text-gray-300 hover:text-red-400 text-xs ml-1 flex-shrink-0">✕</button>
                  </div>
                  <div className="flex flex-1">
                    {MESI.map((_, mi) => {
                      const ore = oreMesi[mi] || 0
                      const ms = msPros.filter(m => meseAnno(m.data, annoVista) === mi)
                      return (
                        <div key={mi} className="flex-1 relative flex items-center justify-center border-r border-dashed border-gray-100 last:border-0"
                          style={{ background: intensityBg(ore, maxOreGlobale, p.colore, true), minHeight:44 }}>
                          {ore > 0 && <span className="text-xs" style={{ color: p.colore }}>{Math.round(ore)}</span>}
                          {ms.map(m => (
                            <div key={m.id} className="absolute top-1 right-1 group z-10">
                              <div className="w-2 h-2 rotate-45 opacity-70" style={{ background: TIPO_COLORS[m.tipo]||'#888' }} />
                              <div className="absolute bottom-full right-0 mb-1 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20">{m.titolo}</div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {progettiAttivi.length === 0 && prospects.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">Nessun progetto attivo. Aggiungi un prospect per iniziare.</p>
          </div>
        )}
      </div>

      {showForm && (
        <NuovoProspectForm
          coloriDisponibili={PROSPECT_COLORS}
          onClose={() => setShowForm(false)}
          onSaved={(p, ms) => { setProspects(prev => [...prev, p]); setMilestones(prev => [...prev, ...ms]); setShowForm(false) }}
        />
      )}
    </div>
  )
}

function NuovoProspectForm({ coloriDisponibili, onClose, onSaved }: {
  coloriDisponibili: string[]
  onClose: () => void
  onSaved: (p: ForecastProgetto, ms: ForecastMilestone[]) => void
}) {
  const [form, setForm] = useState({ nome:'', referente:'', data_inizio:'', data_fine:'', ore_mese:'', colore: coloriDisponibili[0], note:'' })
  const [milestoneList, setMilestoneList] = useState<{titolo:string,data:string,tipo:string}[]>([])
  const [newMs, setNewMs] = useState({ titolo:'', data:'', tipo:'rilascio' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function buildOreMensili(): number[] {
    const ore = new Array(12).fill(0)
    if (!form.data_inizio || !form.data_fine || !form.ore_mese) return ore
    const start = new Date(form.data_inizio)
    const end = new Date(form.data_fine)
    const oreNum = parseFloat(form.ore_mese) || 0
    const annoC = new Date().getFullYear()
    const d = new Date(start)
    while (d <= end) {
      if (d.getFullYear() === annoC) ore[d.getMonth()] = oreNum
      d.setMonth(d.getMonth()+1)
    }
    return ore
  }

  async function handleSalva() {
    if (!form.nome.trim()) { setError('Nome obbligatorio'); return }
    setSaving(true)
    const id = `forecast_${Date.now()}`
    const progetto: ForecastProgetto = {
      id, nome: form.nome.trim(), referente: form.referente||undefined,
      data_inizio: form.data_inizio||null, data_fine: form.data_fine||null,
      ore_mensili: buildOreMensili(), colore: form.colore, note: form.note||undefined,
    }
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/forecast_progetti`, {
        method:'POST', headers:{...SB_HEADERS,'Prefer':'return=minimal'}, body: JSON.stringify(progetto)
      })
      const msObjs: ForecastMilestone[] = []
      for (const ms of milestoneList) {
        const msObj: ForecastMilestone = {
          id:`fms_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          forecast_id: id, titolo: ms.titolo, data: ms.data, tipo: ms.tipo,
        }
        await fetch(`${SUPABASE_URL}/rest/v1/forecast_milestone`, {
          method:'POST', headers:{...SB_HEADERS,'Prefer':'return=minimal'}, body: JSON.stringify(msObj)
        })
        msObjs.push(msObj)
      }
      onSaved(progetto, msObjs)
    } catch(e:any) { setError('Errore: '+e.message) }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Nuovo prospect / previsionale</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-xs text-red-600 px-3 py-2 rounded-lg bg-red-50">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 block mb-1">Nome prospect *</label>
              <input value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))}
                placeholder="es. Vandersande — Sito web"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Referente Wave</label>
              <input value={form.referente} onChange={e => setForm(f=>({...f,referente:e.target.value}))}
                placeholder="es. Valentina"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Ore stimate / mese</label>
              <input type="number" value={form.ore_mese} onChange={e => setForm(f=>({...f,ore_mese:e.target.value}))}
                placeholder="es. 20"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Data inizio</label>
              <input type="date" value={form.data_inizio} onChange={e => setForm(f=>({...f,data_inizio:e.target.value}))}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Data fine</label>
              <input type="date" value={form.data_fine} onChange={e => setForm(f=>({...f,data_fine:e.target.value}))}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-2">Colore</label>
            <div className="flex gap-2 flex-wrap">
              {coloriDisponibili.map(c => (
                <button key={c} onClick={() => setForm(f=>({...f,colore:c}))}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{ background:c, transform: form.colore===c?'scale(1.25)':'scale(1)', boxShadow: form.colore===c?`0 0 0 2px white,0 0 0 3.5px ${c}`:'none' }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-2">Milestone</label>
            {milestoneList.length > 0 && (
              <div className="space-y-1 mb-2">
                {milestoneList.map((ms,i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                    <span className="w-2 h-2 rotate-45 inline-block flex-shrink-0" style={{ background: TIPO_COLORS[ms.tipo]||'#888' }} />
                    <span className="flex-1 text-gray-700">{ms.titolo}</span>
                    <span className="text-gray-400">{ms.data}</span>
                    <button onClick={() => setMilestoneList(prev=>prev.filter((_,j)=>j!==i))} className="text-gray-300 hover:text-red-400">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input value={newMs.titolo} onChange={e=>setNewMs(m=>({...m,titolo:e.target.value}))}
                placeholder="es. Go-live sito"
                className="flex-1 text-xs px-3 py-2 rounded-lg border border-gray-200 outline-none" />
              <input type="date" value={newMs.data} onChange={e=>setNewMs(m=>({...m,data:e.target.value}))}
                className="text-xs px-2 py-2 rounded-lg border border-gray-200 outline-none" />
              <select value={newMs.tipo} onChange={e=>setNewMs(m=>({...m,tipo:e.target.value}))}
                className="text-xs px-2 py-2 rounded-lg border border-gray-200 bg-white outline-none">
                <option value="rilascio">Rilascio</option>
                <option value="golive">Go-live</option>
                <option value="riunione">Riunione</option>
                <option value="altro">Altro</option>
              </select>
              <button onClick={() => {
                if (!newMs.titolo||!newMs.data) return
                setMilestoneList(prev=>[...prev,{...newMs}])
                setNewMs({titolo:'',data:'',tipo:'rilascio'})
              }} className="text-xs px-3 py-2 rounded-lg font-medium flex-shrink-0" style={{ background:'#7DF5DF',color:'#1A1A2E' }}>+</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Note</label>
            <textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}
              rows={2} placeholder="Stato trattativa, note commerciali..."
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600">Annulla</button>
          <button onClick={handleSalva} disabled={saving}
            className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
            style={{ background:'#1A1A2E',color:'#7DF5DF' }}>
            {saving?'Salvataggio...':'Aggiungi prospect'}
          </button>
        </div>
      </div>
    </div>
  )
}
