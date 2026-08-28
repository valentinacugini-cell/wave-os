import React, { useState, useEffect, useMemo } from 'react'
import { Seed, Task } from '../types'

const SUPABASE_URL = 'https://ckkdrtzyowhbddpoziha.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2RydHp5b3doYmRkcG96aWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzU2MzcsImV4cCI6MjA5ODA1MTYzN30.0BSBbjKmrdGtmtr2N2RCIQUZDxGkHObcWYguoarFC2I'
const SB_HEADERS: Record<string,string> = {
  'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json'
}

const TIPO_COLORS: Record<string, string> = {
  rilascio: '#4F86C6', riunione: '#1D9E75', riunione_cliente: '#1D9E75',
  golive: '#0D9488', rinnovo: '#E07B54', altro: '#888780',
}
const PROSPECT_COLORS = ['#A67DC6','#E07B54','#4F86C6','#F9A825','#E53935','#639922','#1D9E75']

// Genera finestra 18 mesi da mese corrente
function genera18Mesi(): {anno: number, mese: number, label: string}[] {
  const oggi = new Date()
  const result = []
  for (let i = 0; i < 18; i++) {
    const d = new Date(oggi.getFullYear(), oggi.getMonth() + i, 1)
    const mesiLabel = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
    result.push({ anno: d.getFullYear(), mese: d.getMonth(), label: `${mesiLabel[d.getMonth()]} ${d.getFullYear()}` })
  }
  return result
}

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
  const [prospectInModifica, setProspectInModifica] = useState<ForecastProgetto | null>(null)

  // Finestra 18 mesi fissa da oggi
  const finestra = useMemo(() => genera18Mesi(), [])

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

  // Ore per progetto nella finestra 18 mesi
  // ore_mensili è array 12 mesi per anno — per prospect usiamo un dict {anno_mese: ore}
  const oreConfermatePerProgetto = useMemo(() => {
    const result: Record<string, Record<string, number>> = {}
    const progettiAttivi = (seed.progetti ?? []).filter(p => p.stato === 'attivo')
    for (const prog of progettiAttivi) {
      const taskProg = (seed.tasks ?? []).filter((t: Task) => t.progetto_id === prog.id)
      const map: Record<string, number> = {}
      for (const t of taskProg) {
        if (t.data_fine) {
          const d = new Date(t.data_fine)
          const k = `${d.getFullYear()}_${d.getMonth()}`
          map[k] = (map[k] || 0) + (Number(t.ore_stimate) || 0)
        }
      }
      result[prog.id] = map
    }
    return result
  }, [seed.progetti, seed.tasks])

  // Milestone confermate (scadenze tipo rilascio/riunione)
  const milestoneConfermate = useMemo(() =>
    (seed.scadenze ?? []).filter((s: any) =>
      s.data && ['rilascio','riunione_cliente','riunione','golive'].includes(s.tipo)
    ), [seed.scadenze])

  // Max ore per scala gradiente
  const maxOreGlobale = useMemo(() => {
    let max = 0
    for (const map of Object.values(oreConfermatePerProgetto))
      for (const v of Object.values(map)) if (v > max) max = v
    for (const p of prospects) {
      for (const v of (p.ore_mensili || [])) if (v > max) max = v
    }
    return max || 1
  }, [oreConfermatePerProgetto, prospects])

  function intensityBg(ore: number, max: number, colore: string, prospect = false): string {
    if (ore === 0) return 'transparent'
    const pct = Math.min(ore / max, 1)
    const alpha = Math.round((prospect ? pct * 0.5 : pct * 0.85) * 255).toString(16).padStart(2,'0')
    return colore + alpha
  }

  function getMsColore(tipo: string): string {
    return TIPO_COLORS[tipo] || '#888780'
  }

  async function handleDeleteProspect(id: string) {
    if (!confirm('Eliminare questo prospect?')) return
    await fetch(`${SUPABASE_URL}/rest/v1/forecast_progetti?id=eq.${id}`, { method:'DELETE', headers: SB_HEADERS })
    setProspects(prev => prev.filter(p => p.id !== id))
    setMilestones(prev => prev.filter(m => m.forecast_id !== id))
  }

  const progettiAttivi = (seed.progetti ?? []).filter(p => p.stato === 'attivo')

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-sm text-gray-400">Caricamento...</p></div>

  // Raggruppa anni per header
  const anniFinestra = [...new Set(finestra.map(f => f.anno))]

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Forecast</h1>
          <p className="text-xs text-gray-400 mt-0.5">Densità operativa — prossimi 18 mesi</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="text-sm px-4 py-2 rounded-lg font-medium"
          style={{ background:'#1A1A2E', color:'#7DF5DF' }}>
          + Prospect
        </button>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-400 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-3 rounded" style={{ background:'linear-gradient(to right,#7DF5DF22,#7DF5DFcc)' }} />Confermato
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-3 rounded border-dashed border" style={{ borderColor:'#A67DC6', background:'linear-gradient(to right,#A67DC611,#A67DC666)' }} />Previsionale
        </div>
        {[['rilascio','Rilascio'],['riunione','Riunione'],['golive','Go-live']].map(([k,l]) => (
          <div key={k} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rotate-45 inline-block flex-shrink-0" style={{ background: getMsColore(k) }} />{l}
          </div>
        ))}
        <span className="text-gray-300">|</span>
        <span className="text-gray-400">La cella si colora anche senza ore se c'è una milestone</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {/* Header anni */}
        <div className="flex border-b border-gray-200" style={{ paddingLeft:200 }}>
          {anniFinestra.map(anno => {
            const count = finestra.filter(f => f.anno === anno).length
            return (
              <div key={anno} className="text-center text-xs font-bold text-gray-500 py-1.5 border-r border-gray-100 last:border-0"
                style={{ flex: count }}>
                {anno}
              </div>
            )
          })}
        </div>
        {/* Header mesi */}
        <div className="flex border-b border-gray-200" style={{ paddingLeft:200, minWidth: 200 + finestra.length * 56 }}>
          {finestra.map((f,i) => (
            <div key={i} className="text-center text-xs font-medium text-gray-400 py-2 border-r border-gray-100 last:border-0"
              style={{ width:56, flexShrink:0 }}>
              {f.label.split(' ')[0]}
            </div>
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
              const oreMap = oreConfermatePerProgetto[prog.id] || {}
              const msProj = milestoneConfermate.filter((s: any) => s.cliente === prog.cliente)

              // Verifica se ha dati nella finestra
              const hasDati = finestra.some(f => {
                const k = `${f.anno}_${f.mese}`
                return (oreMap[k] || 0) > 0 || msProj.some((s: any) => {
                  const d = new Date(s.data)
                  return d.getFullYear() === f.anno && d.getMonth() === f.mese
                })
              })
              if (!hasDati) return null

              return (
                <div key={prog.id} className="flex items-stretch border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  style={{ minWidth: 200 + finestra.length * 56 }}>
                  <div className="flex items-center gap-2 px-4 border-r border-gray-100 flex-shrink-0" style={{ width:200 }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colore }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{cliente?.nome || prog.cliente}</p>
                      <p className="text-xs text-gray-400 truncate">{prog.nome}</p>
                    </div>
                  </div>
                  <div className="flex flex-1">
                    {finestra.map((f, fi) => {
                      const k = `${f.anno}_${f.mese}`
                      const ore = oreMap[k] || 0
                      const ms = msProj.filter((s: any) => {
                        const d = new Date(s.data)
                        return d.getFullYear() === f.anno && d.getMonth() === f.mese
                      })
                      // Se c'è milestone senza ore, colora la cella leggermente
                      const msColore = ms.length > 0 ? getMsColore(ms[0].tipo) : null
                      const bgOre = intensityBg(ore, maxOreGlobale, colore)
                      const bgCella = ore > 0 ? bgOre : (msColore ? msColore + '22' : 'transparent')

                      return (
                        <div key={fi} className="relative flex items-center justify-center border-r border-gray-50 last:border-0 flex-shrink-0"
                          style={{ width:56, minHeight:44, background: bgCella }}>
                          {ore > 0 && (
                            <span className="text-xs font-medium" style={{ color: colore }}>{Math.round(ore)}</span>
                          )}
                          {ms.map((s: any, si: number) => (
                            <div key={si} className="absolute top-1 right-1 group z-10">
                              <div className="w-2.5 h-2.5 rotate-45" style={{ background: getMsColore(s.tipo) }} />
                              <div className="absolute bottom-full right-0 mb-1 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20 min-w-max">
                                <p className="font-medium">{s.titolo}</p>
                                <p className="text-white/60">{new Date(s.data).toLocaleDateString('it-IT')}</p>
                              </div>
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
              // ore_mensili è array 12 mesi — per prospect mappiamo sull'anno di data_inizio
              // Usiamo un mapping anno+mese → ore dalle ore_mensili
              const annoInizio = p.data_inizio ? new Date(p.data_inizio).getFullYear() : new Date().getFullYear()
              const meseInizio = p.data_inizio ? new Date(p.data_inizio).getMonth() : 0
              const annoFine = p.data_fine ? new Date(p.data_fine).getFullYear() : annoInizio
              const meseFine = p.data_fine ? new Date(p.data_fine).getMonth() : 11

              // Distribuiamo le ore_mensili partendo dal mese di inizio
              function getOre(anno: number, mese: number): number {
                // Calcola indice nell'array ore_mensili
                const inizio = new Date(annoInizio, meseInizio, 1)
                const target = new Date(anno, mese, 1)
                if (target < inizio) return 0
                const idx = (target.getFullYear() - inizio.getFullYear()) * 12 + target.getMonth() - inizio.getMonth()
                if (idx < 0 || idx >= (p.ore_mensili || []).length) return 0
                // Verifica che sia nel periodo
                const fine = new Date(annoFine, meseFine, 28)
                if (target > fine) return 0
                return p.ore_mensili[idx] || 0
              }

              const msPros = milestones.filter(m => m.forecast_id === p.id)

              return (
                <div key={p.id} className="flex items-stretch border-b border-dashed border-gray-200 hover:bg-purple-50 transition-colors group/row"
                  style={{ minWidth: 200 + finestra.length * 56 }}>
                  <div className="flex items-center gap-2 px-4 border-r border-dashed border-gray-200 flex-shrink-0" style={{ width:200 }}>
                    <div className="w-2 h-2 rounded-full border-2 flex-shrink-0" style={{ borderColor: p.colore, background: p.colore+'33' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate" style={{ color: p.colore }}>{p.nome}</p>
                      {p.referente && <p className="text-xs text-gray-400 truncate">{p.referente}</p>}
                    </div>
                    <div className="opacity-0 group-hover/row:opacity-100 flex gap-1 ml-1 flex-shrink-0">
                      <button onClick={() => setProspectInModifica(p)}
                        className="text-gray-300 hover:text-teal-500 text-xs">✎</button>
                      <button onClick={() => handleDeleteProspect(p.id)}
                        className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  </div>
                  <div className="flex flex-1">
                    {finestra.map((f, fi) => {
                      const ore = getOre(f.anno, f.mese)
                      const ms = msPros.filter(m => {
                        const d = new Date(m.data)
                        return d.getFullYear() === f.anno && d.getMonth() === f.mese
                      })
                      const msColore = ms.length > 0 ? getMsColore(ms[0].tipo) : null
                      const bgOre = intensityBg(ore, maxOreGlobale, p.colore, true)
                      const bgCella = ore > 0 ? bgOre : (msColore ? msColore + '18' : 'transparent')

                      return (
                        <div key={fi} className="relative flex items-center justify-center border-r border-dashed border-gray-100 last:border-0 flex-shrink-0"
                          style={{ width:56, minHeight:44, background: bgCella }}>
                          {ore > 0 && <span className="text-xs" style={{ color: p.colore }}>{Math.round(ore)}</span>}
                          {ms.map((m, mi) => (
                            <div key={mi} className="absolute top-1 right-1 group z-10">
                              <div className="w-2.5 h-2.5 rotate-45" style={{ background: getMsColore(m.tipo), opacity: 0.85 }} />
                              <div className="absolute bottom-full right-0 mb-1 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20 min-w-max">
                                <p className="font-medium">{m.titolo}</p>
                                <p className="text-white/60">{m.data}</p>
                              </div>
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
          onSaved={(p, ms) => {
            setProspects(prev => [...prev, p])
            setMilestones(prev => [...prev, ...ms])
            setShowForm(false)
          }}
        />
      )}
      {prospectInModifica && (
        <NuovoProspectForm
          coloriDisponibili={PROSPECT_COLORS}
          prospect={prospectInModifica}
          milestoneEsistenti={milestones.filter(m => m.forecast_id === prospectInModifica.id)}
          onClose={() => setProspectInModifica(null)}
          onSaved={(p, ms) => {
            setProspects(prev => prev.map(x => x.id === p.id ? p : x))
            setMilestones(prev => [
              ...prev.filter(m => m.forecast_id !== p.id),
              ...ms
            ])
            setProspectInModifica(null)
          }}
        />
      )}
    </div>
  )
}

// ── Form nuovo prospect ───────────────────────────────────────────────────

function NuovoProspectForm({ coloriDisponibili, prospect, milestoneEsistenti, onClose, onSaved }: {
  coloriDisponibili: string[]
  prospect?: ForecastProgetto
  milestoneEsistenti?: ForecastMilestone[]
  onClose: () => void
  onSaved: (p: ForecastProgetto, ms: ForecastMilestone[]) => void
}) {
  const isModifica = !!prospect

  // Pre-calcola stato iniziale per modifica
  const valoriIniziali = useMemo(() => {
    if (!prospect) return { oreFlat: '', isCustom: false, oreCustomInit: {} as Record<string,string> }
    const ore = prospect.ore_mensili || []
    const nonZero = ore.filter(v => v > 0)
    const tutteUguali = nonZero.length > 0 && nonZero.every(v => v === nonZero[0])
    const isCustom = !tutteUguali && nonZero.length > 0
    const oreFlat = tutteUguali ? nonZero[0].toString() : ''

    // Ricostruisce mappa anno_mese → ore per la modalità custom
    const oreCustomInit: Record<string,string> = {}
    if (isCustom && prospect.data_inizio) {
      const start = new Date(prospect.data_inizio)
      ore.forEach((v, i) => {
        if (v > 0) {
          const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
          oreCustomInit[`${d.getFullYear()}_${d.getMonth()}`] = v.toString()
        }
      })
    }
    return { oreFlat, isCustom, oreCustomInit }
  }, [prospect])

  const [form, setForm] = useState({
    nome: prospect?.nome || '',
    referente: prospect?.referente || '',
    data_inizio: prospect?.data_inizio || '',
    data_fine: prospect?.data_fine || '',
    distribuzione: (valoriIniziali.isCustom ? 'custom' : 'flat') as 'flat' | 'custom',
    ore_mese: valoriIniziali.oreFlat,
    colore: prospect?.colore || coloriDisponibili[0],
    note: prospect?.note || '',
  })
  const [milestoneList, setMilestoneList] = useState<{titolo:string,data:string,tipo:string}[]>(
    milestoneEsistenti?.map(m => ({ titolo: m.titolo, data: m.data, tipo: m.tipo })) || []
  )
  const [newMs, setNewMs] = useState({ titolo:'', data:'', tipo:'rilascio' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [oreCustomInit] = useState<Record<string,string>>(valoriIniziali.oreCustomInit)

  // Mesi nel periodo per distribuzione custom
  const mesiPeriodo = useMemo(() => {
    if (!form.data_inizio || !form.data_fine) return []
    const result: {anno: number, mese: number, label: string}[] = []
    const mesiLabel = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
    const start = new Date(form.data_inizio)
    const end = new Date(form.data_fine)
    const d = new Date(start.getFullYear(), start.getMonth(), 1)
    while (d <= end && result.length < 24) {
      result.push({ anno: d.getFullYear(), mese: d.getMonth(), label: `${mesiLabel[d.getMonth()]} ${d.getFullYear()}` })
      d.setMonth(d.getMonth() + 1)
    }
    return result
  }, [form.data_inizio, form.data_fine])

  const [oreCustom, setOreCustom] = useState<Record<string, string>>(oreCustomInit)

  function buildOreMensili(): number[] {
    if (!form.data_inizio) return new Array(12).fill(0)
    const annoInizio = new Date(form.data_inizio).getFullYear()
    const meseInizio = new Date(form.data_inizio).getMonth()
    const numMesi = mesiPeriodo.length || 12
    const ore = new Array(numMesi).fill(0)

    if (form.distribuzione === 'flat') {
      const oreNum = parseFloat(form.ore_mese) || 0
      for (let i = 0; i < numMesi; i++) ore[i] = oreNum
    } else {
      for (let i = 0; i < mesiPeriodo.length; i++) {
        const f = mesiPeriodo[i]
        const k = `${f.anno}_${f.mese}`
        ore[i] = parseFloat(oreCustom[k] || '0') || 0
      }
    }
    return ore
  }

  async function handleSalva() {
    if (!form.nome.trim()) { setError('Nome obbligatorio'); return }
    setSaving(true)
    const id = isModifica ? prospect!.id : `forecast_${Date.now()}`
    const progetto: ForecastProgetto = {
      id, nome: form.nome.trim(), referente: form.referente || undefined,
      data_inizio: form.data_inizio || null, data_fine: form.data_fine || null,
      ore_mensili: buildOreMensili(), colore: form.colore, note: form.note || undefined,
    }
    try {
      if (isModifica) {
        await fetch(`${SUPABASE_URL}/rest/v1/forecast_progetti?id=eq.${id}`, {
          method:'PATCH', headers:{...SB_HEADERS,'Prefer':'return=minimal'}, body: JSON.stringify(progetto)
        })
        // Elimina milestone vecchie e reinserisce
        await fetch(`${SUPABASE_URL}/rest/v1/forecast_milestone?forecast_id=eq.${id}`, {
          method:'DELETE', headers: SB_HEADERS
        })
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/forecast_progetti`, {
          method:'POST', headers:{...SB_HEADERS,'Prefer':'return=minimal'}, body: JSON.stringify(progetto)
        })
      }
      const msObjs: ForecastMilestone[] = []
      for (const ms of milestoneList) {
        const msObj: ForecastMilestone = {
          id: `fms_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          forecast_id: id, titolo: ms.titolo, data: ms.data, tipo: ms.tipo,
        }
        await fetch(`${SUPABASE_URL}/rest/v1/forecast_milestone`, {
          method:'POST', headers:{...SB_HEADERS,'Prefer':'return=minimal'}, body: JSON.stringify(msObj)
        })
        msObjs.push(msObj)
      }
      onSaved(progetto, msObjs)
    } catch(e:any) { setError('Errore: ' + e.message) }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{isModifica ? 'Modifica prospect' : 'Nuovo prospect / previsionale'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
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
                placeholder="es. Gloria"
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Colore</label>
              <div className="flex gap-2 flex-wrap pt-1">
                {coloriDisponibili.map(c => (
                  <button key={c} onClick={() => setForm(f=>({...f,colore:c}))}
                    className="w-6 h-6 rounded-full transition-all flex-shrink-0"
                    style={{ background:c, transform: form.colore===c?'scale(1.3)':'scale(1)', boxShadow: form.colore===c?`0 0 0 2px white,0 0 0 3.5px ${c}`:'none' }} />
                ))}
              </div>
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

          {/* Distribuzione ore */}
          <div>
            <label className="text-xs text-gray-400 block mb-2">Distribuzione ore</label>
            <div className="flex gap-2 mb-3">
              {(['flat','custom'] as const).map(tipo => (
                <button key={tipo} onClick={() => setForm(f=>({...f,distribuzione:tipo}))}
                  className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                  style={{
                    borderColor: form.distribuzione===tipo ? '#0D9488' : '#E5E7EB',
                    background: form.distribuzione===tipo ? '#F0FDFB' : 'white',
                    color: form.distribuzione===tipo ? '#0D9488' : '#6B7280',
                    fontWeight: form.distribuzione===tipo ? 600 : 400,
                  }}>
                  {tipo === 'flat' ? '📊 Flat (uguale ogni mese)' : '📈 Personalizzata (picchi)'}
                </button>
              ))}
            </div>

            {form.distribuzione === 'flat' ? (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Ore stimate / mese</label>
                <input type="number" value={form.ore_mese} onChange={e => setForm(f=>({...f,ore_mese:e.target.value}))}
                  placeholder="es. 20"
                  className="w-40 text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none" />
              </div>
            ) : (
              <div>
                {mesiPeriodo.length === 0 ? (
                  <p className="text-xs text-gray-400">Inserisci data inizio e fine per specificare le ore per mese.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {mesiPeriodo.map(f => {
                      const k = `${f.anno}_${f.mese}`
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16 flex-shrink-0">{f.label}</span>
                          <input type="number" value={oreCustom[k] || ''} onChange={e => setOreCustom(prev=>({...prev,[k]:e.target.value}))}
                            placeholder="0"
                            className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 outline-none text-center" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Milestone */}
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
            {saving ? 'Salvataggio...' : (isModifica ? 'Salva modifiche' : 'Aggiungi prospect')}
          </button>
        </div>
      </div>
    </div>
  )
}
