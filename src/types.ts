export type PersonaTipo = 'operativo' | 'commerciale'

export interface Persona {
  id: string
  nome: string
  ruolo: string
  tipo: PersonaTipo
  ore_settimana?: number
  colore: string
}

export type ClienteStato = 'attivo' | 'in_attesa' | 'pausa' | 'concluso'
export type ClienteTipo = 'nuovo' | 'progetto_complesso' | 'gestione_continuativa'
export type TipoContratto = 'progetto' | 'ppl'

export interface Cliente {
  id: string
  nome: string
  stato: ClienteStato
  tipo: ClienteTipo
  tipo_contratto: TipoContratto
  referente: string
  commerciale: string
  scadenza_contratto: string | null
  rinnovo_previsto: string | null
  lead_obiettivo?: number | null
  lead_raccolte?: number | null
  note?: string
}

export interface CapacitaRiga {
  persona: string
  valori: number[]
}

export interface AllocazioneRiga {
  cliente: string
  persona: string
  area: string
  valori: number[]
}

export type ScadenzaTipo = 'rinnovo' | 'rilascio' | 'riunione_cliente' | 'interno' | 'checkpoint'
export type ScadenzaStato = 'aperto' | 'completato' | 'posticipato'
export type ScadenzaUrgenza = 'critica' | 'alta' | 'normale'

export interface Scadenza {
  id: string
  tipo: ScadenzaTipo
  cliente: string | null
  titolo: string
  data: string
  referente: string
  stato: ScadenzaStato
  urgenza: ScadenzaUrgenza
  note?: string | null
  progetto_id?: string | null
}

export type TaskStato = 'da_fare' | 'in_corso' | 'completato' | 'bloccato' | 'in_attesa_materiali'
export type TaskPriorita = 'alta' | 'media' | 'bassa'

export interface Task {
  id: string
  cliente: string
  area: string
  milestone?: string | null
  titolo: string
  assegnatari: string[]
  ore_stimate: number
  data_inizio: string
  data_fine: string
  priorita: TaskPriorita
  stato: TaskStato
  ricorrente: boolean
  frequenza?: string
  note?: string | null
  progetto_id?: string | null
}

export interface Progetto {
  id: string
  cliente: string
  nome: string
  anno: number
  ore_contratto: number
  stato: 'attivo' | 'concluso' | 'sospeso'
  data_inizio: string
  data_fine: string
}

export interface Contatto {
  id: string
  cliente: string
  nome: string
  ruolo: string
  email?: string | null
  telefono?: string | null
  principale: boolean
}

export interface NoteRinnovo {
  cliente: string
  note: string
  anno_precedente_valore?: number | null
  anno_corrente_proposta?: number | null
}

export interface Seed {
  team: Persona[]
  clienti: Cliente[]
  mesi: string[]
  mesi_label: string[]
  anno: number
  capacita: CapacitaRiga[]
  ore_pianificate: CapacitaRiga[]
  ore_consuntivate: CapacitaRiga[]
  allocazioni: AllocazioneRiga[]
  scadenze: Scadenza[]
  progetti: Progetto[]
  tasks: Task[]
  contatti: Contatto[]
  note_rinnovo: NoteRinnovo[]
}

export type AlertLevel = 'critica' | 'attenzione' | 'ok' | 'in_attesa'
export type View = 'home' | 'carico' | 'scadenze' | 'operativita' | 'cliente' | 'forecast' | 'impostazioni'
