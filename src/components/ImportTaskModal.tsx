import React, { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { Task, TaskPriorita, TaskStato, Progetto, Persona } from '../types'

interface ImportTaskModalProps {
  progetti: Progetto[]
  personaById: Record<string, Persona>
  clienteId: string
  onClose: () => void
  onImport: (tasks: Omit<Task, 'id'>[]) => Promise<void>
}

interface RigaImport {
  row: number
  progetto: string
  area: string
  milestone: string
  titolo: string
  assegnatari: string[]
  ore_stimate: number
  data_inizio: string
  data_fine: string
  priorita: TaskPriorita
  stato: TaskStato
  ricorrente: boolean
  frequenza: string
  note: string
  errori: string[]
  progetto_id: string | null
}

const NOMI_PERSONA: Record<string, string> = {
  'gloria ubaldini': 'gloria',
  'giulia maria masnata': 'giulia',
  'ivana gimigliano': 'ivana',
  'valentina cugini': 'valentina',
}

const AREE_VALIDE = ['web', 'adv', 'content', 'strategia', 'grafica', 'gestione', 'dev']

function normalizzaData(val: any): string {
  if (!val) return ''
  if (typeof val === 'number') {
    // Excel serial date
    const date = new Date(Math.round((val - 25569) * 86400 * 1000))
    return date.toISOString().slice(0, 10)
  }
  if (typeof val === 'string') {
    // GG/MM/AAAA o AAAA-MM-GG
    const parts = val.split('/')
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return val
  }
  return ''
}

function normalizzaPriorita(val: any): TaskPriorita {
  const v = String(val ?? '').toLowerCase().trim()
  if (v === 'alta' || v === 'high') return 'alta'
  if (v === 'bassa' || v === 'low') return 'bassa'
  return 'media'
}

function normalizzaStato(val: any): TaskStato {
  const v = String(val ?? '').toLowerCase().trim()
  if (v === 'in corso' || v === 'in progress') return 'in_corso'
  if (v === 'completato' || v === 'done') return 'completato'
  if (v === 'bloccato' || v === 'blocked') return 'bloccato'
  if (v === 'attesa materiali' || v === 'attesa') return 'in_attesa_materiali'
  return 'da_fare'
}

function normalizzaArea(val: any): string {
  const v = String(val ?? '').toLowerCase().trim()
  if (v === 'web' || v === 'dev') return 'Dev'
  if (v === 'adv') return 'ADV'
  if (v === 'content') return 'Content'
  if (v === 'strategia') return 'Strategia'
  if (v === 'grafica') return 'Grafica'
  if (v === 'gestione') return 'Gestione'
  return v.charAt(0).toUpperCase() + v.slice(1)
}

export default function ImportTaskModal({ progetti, personaById, clienteId, onClose, onImport }: ImportTaskModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [righe, setRighe] = useState<RigaImport[]>([])
  const [progettoDefault, setProgettoDefault] = useState(progetti[0]?.id ?? '')
  const [dragging, setDragging] = useState(false)

  const nomeToId = useCallback((nome: string): string | null => {
    const key = nome.toLowerCase().trim()
    const shortId = NOMI_PERSONA[key]
    if (shortId) {
      const p = Object.values(personaById).find(p => p.id === shortId)
      return p?.id ?? null
    }
    // Cerca per corrispondenza parziale
    const found = Object.values(personaById).find(p =>
      p.nome.toLowerCase().includes(key) || key.includes(p.nome.toLowerCase().split(' ')[0])
    )
    return found?.id ?? null
  }, [personaById])

  function parseFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })

      // Cerca il foglio principale
      const sheetName = wb.SheetNames.find(n =>
        n.toLowerCase().includes('matrice') || n.toLowerCase().includes('wave') || n.toLowerCase().includes('task')
      ) ?? wb.SheetNames[0]

      const ws = wb.Sheets[sheetName]
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Trova la riga intestazioni (cerca "NOME ATTIVITÀ" o "NOME DEL COMPITO")
      let headerRow = -1
      for (let i = 0; i < Math.min(raw.length, 10); i++) {
        const row = raw[i].map((c: any) => String(c).toLowerCase())
        if (row.some(c => c.includes('nome attività') || c.includes('nome del compito') || c.includes('titolo'))) {
          headerRow = i
          break
        }
      }

      if (headerRow === -1) {
        alert('Intestazioni non trovate. Verifica che il file usi il template Wave OS.')
        return
      }

      const headers = raw[headerRow].map((h: any) => String(h).toLowerCase().trim())

      // Mappa colonne
      const col = (names: string[]) => {
        for (const n of names) {
          const idx = headers.findIndex(h => h.includes(n))
          if (idx >= 0) return idx
        }
        return -1
      }

      const cols = {
        progetto: col(['progetto']),
        area: col(['area', 'tag']),
        milestone: col(['milestone']),
        titolo: col(['nome attività', 'nome del compito', 'titolo', 'compito']),
        assegnatari: col(['assegnatari', 'proprietario']),
        ore: col(['ore stimate', 'ore di lavoro', 'ore']),
        dataInizio: col(['data inizio', 'data di inizio']),
        dataFine: col(['data fine', 'data di scadenza', 'data di fine']),
        priorita: col(['priorità', 'priorita']),
        stato: col(['stato', 'status']),
        ricorrente: col(['ricorrente']),
        frequenza: col(['frequenza']),
        note: col(['note', 'descrizione']),
      }

      const risultato: RigaImport[] = []

      for (let i = headerRow + 1; i < raw.length; i++) {
        const r = raw[i]
        // Salta righe vuote o di guida
        const titolo = cols.titolo >= 0 ? String(r[cols.titolo] ?? '').trim() : ''
        if (!titolo || titolo.toLowerCase().includes('es.') || titolo.toLowerCase().includes('esempio')) continue

        const errori: string[] = []

        // Assegnatari
        const assRaw = cols.assegnatari >= 0 ? String(r[cols.assegnatari] ?? '') : ''
        const assegnatari = assRaw.split(',').map(n => n.trim()).filter(Boolean)
          .map(n => nomeToId(n)).filter(Boolean) as string[]
        if (assegnatari.length === 0) errori.push('Nessun assegnatario riconosciuto')

        // Date
        const dataFine = normalizzaData(cols.dataFine >= 0 ? r[cols.dataFine] : '')
        const dataInizio = normalizzaData(cols.dataInizio >= 0 ? r[cols.dataInizio] : '') || dataFine

        if (!dataFine) errori.push('Data fine mancante')

        // Ore
        const ore = cols.ore >= 0 ? Number(r[cols.ore]) || 0 : 0

        // Progetto — cerca tra quelli del cliente
        const progettoNomeRiga = cols.progetto >= 0 ? String(r[cols.progetto] ?? '').trim() : ''
        let progettoId: string | null = progettoDefault
        if (progettoNomeRiga) {
          const found = progetti.find(p => p.nome.toLowerCase().includes(progettoNomeRiga.toLowerCase().slice(0, 10)))
          if (found) progettoId = found.id
        }

        risultato.push({
          row: i + 1,
          progetto: progettoNomeRiga,
          area: normalizzaArea(cols.area >= 0 ? r[cols.area] : ''),
          milestone: cols.milestone >= 0 ? String(r[cols.milestone] ?? '').trim() : '',
          titolo,
          assegnatari,
          ore_stimate: ore,
          data_inizio: dataInizio,
          data_fine: dataFine,
          priorita: normalizzaPriorita(cols.priorita >= 0 ? r[cols.priorita] : 'media'),
          stato: normalizzaStato(cols.stato >= 0 ? r[cols.stato] : 'aperto'),
          ricorrente: String(r[cols.ricorrente ?? -1] ?? '').toLowerCase() === 'sì',
          frequenza: cols.frequenza >= 0 ? String(r[cols.frequenza] ?? '').trim() : '',
          note: cols.note >= 0 ? String(r[cols.note] ?? '').trim() : '',
          errori,
          progetto_id: progettoId,
        })
      }

      setRighe(risultato)
      setStep('preview')
    }
    reader.readAsArrayBuffer(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  function handleImport() {
    const valide = righe.filter(r => r.errori.length === 0)
    const tasks: Omit<Task, 'id'>[] = valide.map(r => ({
      cliente: clienteId,
      area: r.area,
      milestone: r.milestone || null,
      titolo: r.titolo,
      assegnatari: r.assegnatari,
      ore_stimate: r.ore_stimate,
      data_inizio: r.data_inizio || r.data_fine,
      data_fine: r.data_fine,
      priorita: r.priorita,
      stato: r.stato,
      ricorrente: r.ricorrente,
      frequenza: r.frequenza || undefined,
      note: r.note || null,
      progetto_id: r.progetto_id,
    }))
    onImport(tasks)
    setStep('done')
  }

  const conErrori = righe.filter(r => r.errori.length > 0).length
  const valide = righe.filter(r => r.errori.length === 0).length

  const PRIO_COLOR: Record<TaskPriorita, string> = { alta: '#E24B4A', media: '#EF9F27', bassa: '#639922' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full mx-4 overflow-hidden flex flex-col"
        style={{ maxWidth: 900, maxHeight: '90vh' }}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0"
          style={{ background: '#F8F9FA' }}>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Importa task da Excel</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === 'upload' && 'Carica il file Excel compilato con il template Wave OS'}
              {step === 'preview' && `${righe.length} righe trovate · ${valide} valide · ${conErrori} con errori`}
              {step === 'done' && `${valide} task importati con successo`}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
            ✕
          </button>
        </div>

        {/* Contenuto */}
        <div className="flex-1 overflow-auto px-6 py-5">

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div>
              {/* Progetto di destinazione */}
              <div className="mb-5">
                <label className="text-xs text-gray-500 font-medium block mb-1">
                  Progetto di destinazione
                </label>
                {progetti.length === 0 ? (
                  <div className="px-3 py-2 rounded-lg border border-orange-200 text-xs text-orange-600"
                    style={{ background: '#FFF7ED' }}>
                    Nessun progetto creato. Vai su Anagrafica → + Nuovo progetto, poi torna qui.
                  </div>
                ) : (
                  <select value={progettoDefault} onChange={e => setProgettoDefault(e.target.value)}
                    className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none w-full max-w-md">
                    <option value="">Seleziona progetto...</option>
                    {progetti.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                )}
              </div>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
                style={{ borderColor: dragging ? '#3DD4BE' : '#E0E0E0', background: dragging ? '#F0FDFB' : '#FAFAFA' }}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: '#E0FDF8' }}>
                  <span className="text-2xl">📊</span>
                </div>
                <p className="text-base font-semibold text-gray-900 mb-1">
                  Trascina il file Excel qui
                </p>
                <p className="text-sm text-gray-400 mb-4">oppure clicca per selezionarlo</p>
                <span className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: '#1A1A2E', color: '#7DF5DF' }}>
                  Seleziona file .xlsx
                </span>
                <input id="file-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </div>

              <p className="text-xs text-gray-400 text-center mt-4">
                Usa il template Wave OS — colonne: PROGETTO, AREA, MILESTONE, NOME ATTIVITÀ, ASSEGNATARI, ORE STIMATE, DATA FINE, PRIORITÀ, STATO
              </p>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 'preview' && (
            <div>
              {/* Summary */}
              <div className="flex gap-3 mb-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                  style={{ background: '#EAF3DE', color: '#27500A' }}>
                  ✓ {valide} task pronti
                </div>
                {conErrori > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                    style={{ background: '#FFEBEE', color: '#C62828' }}>
                    ⚠ {conErrori} righe con errori (non verranno importate)
                  </div>
                )}
                <button onClick={() => setStep('upload')}
                  className="ml-auto text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                  ← Carica altro file
                </button>
              </div>

              {/* Righe con errori in evidenza */}
              {conErrori > 0 && (
                <div className="mb-4 rounded-xl border border-red-200 overflow-hidden"
                  style={{ background: '#FFF8F8' }}>
                  <div className="px-4 py-2 border-b border-red-100 flex items-center gap-2"
                    style={{ background: '#FFEBEE' }}>
                    <span className="text-xs font-semibold text-red-700">
                      ⚠ {conErrori} righe con errori — non verranno importate
                    </span>
                  </div>
                  {righe.filter(r => r.errori.length > 0).map((r, i) => (
                    <div key={i} className="px-4 py-3 border-b border-red-100 last:border-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">Riga {r.row}: {r.titolo}</p>
                          <div className="flex flex-col gap-1 mt-1.5">
                            {r.errori.map((err, ei) => (
                              <div key={ei} className="flex items-center gap-2">
                                <span className="text-xs text-red-600 font-medium">· {err}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Fix rapido assegnatari */}
                        {r.errori.some(e => e.includes('assegnatario')) && (
                          <div className="flex-shrink-0">
                            <label className="text-xs text-gray-500 block mb-1">Assegna a:</label>
                            <select
                              className="text-xs px-2 py-1 rounded border border-gray-200 bg-white outline-none"
                              onChange={e => {
                                if (!e.target.value) return
                                setRighe(prev => prev.map(row =>
                                  row.row === r.row
                                    ? { ...row, assegnatari: [e.target.value], errori: row.errori.filter(err => !err.includes('assegnatario')) }
                                    : row
                                ))
                              }}>
                              <option value="">Seleziona...</option>
                              {Object.values(personaById).filter(p => p.tipo === 'operativo').map(p => (
                                <option key={p.id} value={p.id}>{p.nome}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {/* Fix data mancante */}
                        {r.errori.some(e => e.includes('data fine')) && (
                          <div className="flex-shrink-0">
                            <label className="text-xs text-gray-500 block mb-1">Data fine:</label>
                            <input type="date"
                              className="text-xs px-2 py-1 rounded border border-gray-200 bg-white outline-none"
                              onChange={e => {
                                if (!e.target.value) return
                                setRighe(prev => prev.map(row =>
                                  row.row === r.row
                                    ? { ...row, data_fine: e.target.value, data_inizio: row.data_inizio || e.target.value, errori: row.errori.filter(err => !err.includes('data fine')) }
                                    : row
                                ))
                              }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabella anteprima completa */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E0E0E0' }}>
                      {['', 'Titolo', 'Area', 'Milestone', 'Assegnatari', 'Ore', 'Scadenza', 'Priorità', 'Stato'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {righe.map((r, i) => {
                      const hasError = r.errori.length > 0
                      return (
                        <tr key={i} style={{
                          borderBottom: '1px solid #F0F0F0',
                          background: hasError ? '#FFF8F8' : i % 2 === 0 ? 'white' : '#FAFAFA',
                        }}>
                          <td className="px-3 py-1.5 w-6">
                            {hasError
                              ? <span className="text-red-500 font-bold">✕</span>
                              : <span className="text-green-500">✓</span>
                            }
                          </td>
                          <td className="px-3 py-1.5 font-medium text-gray-900" style={{ maxWidth: 200 }}>
                            <p className="truncate">{r.titolo}</p>
                          </td>
                          <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{r.area}</td>
                          <td className="px-3 py-1.5 text-gray-400" style={{ maxWidth: 120 }}>
                            <p className="truncate">{r.milestone || '—'}</p>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex gap-0.5">
                              {r.assegnatari.map(pid => {
                                const p = personaById[pid]
                                return p ? (
                                  <span key={pid} className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold"
                                    style={{ background: p.colore, fontSize: 8 }}>{p.nome.charAt(0)}</span>
                                ) : null
                              })}
                              {r.assegnatari.length === 0 && <span className="text-red-400 text-xs">—</span>}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{r.ore_stimate > 0 ? `${r.ore_stimate}h` : '—'}</td>
                          <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{r.data_fine ? r.data_fine.slice(0,10) : '—'}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full inline-block mr-1"
                              style={{ background: PRIO_COLOR[r.priorita] }} />
                            {r.priorita}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{r.stato.replace(/_/g, ' ')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: DONE */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: '#EAF3DE' }}>
                <span className="text-3xl">✓</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{valide} task importati</h3>
              <p className="text-sm text-gray-400">I task sono stati aggiunti al progetto nella sessione corrente.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0"
          style={{ background: '#F8F9FA' }}>
          <p className="text-xs text-gray-400">
            {step === 'preview' && conErrori > 0 && `Le ${conErrori} righe con errori non verranno importate.`}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
              {step === 'done' ? 'Chiudi' : 'Annulla'}
            </button>
            {step === 'preview' && valide > 0 && (
              <button onClick={handleImport}
                className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                style={{ background: '#7DF5DF', color: '#1A1A2E' }}>
                Importa {valide} task
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
