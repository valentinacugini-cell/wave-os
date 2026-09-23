export type PersonaTipo = 'operativo' | 'commerciale'

export interface Persona {
  id: string
  nome: string
  ruolo: string
  tipo: PersonaTipo
  ore_settimana?: number
  colore: string
  capacita_mensile?: number[]
  ore_pianificate?: number[]
  ore_effettive_mensili?: number[]
  auth_user_id?: string | null
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
export type ScadenzaStato = 'aperto' | 'chiuso'
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
  completed_at?: string | null
  cancelled_at?: string | null
}

export type TaskStato = 'da_fare' | 'in_corso' | 'completato' | 'annullato'
export type TaskPriorita = 'alta' | 'media' | 'bassa' | 'urgente'
export type BloccTipo = 'nessuno' | 'attesa_cliente' | 'attesa_materiali' | 'dipendenza_interna' | 'altro'
export type MigrationReviewReason = 'multi_assegnatario' | 'stima_anomala'

// Stato pianificazione derivato — calcolato, non salvato
export type TaskPianificazioneStato =
  | 'da_stimare'          // ore_stimate IS NULL
  | 'da_assegnare'        // ore_stimate > ore_assegnate totali
  | 'da_pianificare'      // ore_assegnate > 0, ore_pianificate = 0
  | 'parziale'            // 0 < ore_pianificate < ore_assegnate
  | 'pianificato'         // ore_pianificate = ore_assegnate
  | 'non_assegnato'       // ore_stimate = 0 o null, nessuna assegnazione

export interface Task {
  id: string
  cliente: string
  area: string
  milestone?: string | null          // legacy text — mantenuto per compatibilità
  milestone_id?: string | null       // FK → scadenze.id
  titolo: string
  assegnatari: string[]              // LEGACY — mantenuto per viste legacy, fonte autoritativa = assegnazioni
  ore_stimate: number | null         // NULL = non ancora stimato
  data_inizio: string | null
  data_fine: string | null           // LEGACY deadline — usare deadline
  priorita: TaskPriorita
  stato: TaskStato
  ricorrente: boolean
  frequenza?: string | null
  note?: string | null
  progetto_id?: string | null
  link_operativo?: string | null
  // Lifecycle Fase 1
  deadline?: string | null
  blocco_tipo?: BloccTipo | null
  blocco_note?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  archived_at?: string | null
  needs_assignment_review?: boolean
  migration_review_reason?: MigrationReviewReason | null
}

// Task arricchito con dati calcolati — usato nelle viste operative nuove
export interface TaskConDati extends Task {
  assegnazioni: Assegnazione[]
  allocazioni: Allocazione[]
  ore_assegnate_totali: number
  ore_pianificate_totali: number
  ore_da_assegnare: number | null    // null se non stimato
  ore_da_pianificare: number
  pianificazione_stato: TaskPianificazioneStato
  prossima_data_pianificata: string | null
}

export interface Progetto {
  id: string
  cliente: string
  nome: string
  anno: number
  ore_contratto: number
  importo_contratto?: number | null
  note_commerciali?: string | null
  rinnovo_previsto?: string | null
  responsabile_id?: string | null
  stato: 'pianificato' | 'attivo' | 'sospeso' | 'concluso' | 'annullato'
  data_inizio?: string | null
  data_fine?: string | null
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

// Nuove entità Fase 1 — operative da Fase 2B
export interface Assegnazione {
  id: string
  task_id: string
  persona_id: string
  ore_assegnate: number
  note?: string | null
  created_at?: string
  updated_at?: string
}

export interface Allocazione {
  id: string
  assegnazione_id: string
  ore: number
  data_inizio: string   // giorno preciso (data_inizio = data_fine per allocazione giornaliera)
  data_fine: string
  note?: string | null
  created_at?: string
  updated_at?: string
}

export interface CapacitaPersona {
  id: string
  persona_id: string
  anno: number
  mese: number
  ore_disponibili: number
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
export type View = 'home' | 'carico' | 'scadenze' | 'operativita' | 'cliente' | 'forecast' | 'impostazioni' | 'miei_task'
