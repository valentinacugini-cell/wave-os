/**
 * TaskDataContext — Fase 2B
 * Unico store runtime per task, assegnazioni, allocazioni.
 * Le viste legacy continuano a leggere da seed (via App.tsx).
 * Le nuove viste (I miei task) leggono da questo context.
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { TaskConDati, Assegnazione, Allocazione } from '../types'
import { fetchTaskConDati, creaTaskAtomico, modificaTaskAtomico, completaTask, archivaTask, eliminaAllocazione, NuovoTaskInput, ModificaTaskInput } from '../lib/taskData'

interface TaskDataState {
  tasks: TaskConDati[]
  loading: boolean
  error: string | null
}

interface TaskDataContextValue extends TaskDataState {
  // Caricamento
  carica: (opts: { personaId?: string; clienteId?: string; includiCompletati?: boolean }) => Promise<void>
  // Mutation
  creaTask: (input: NuovoTaskInput) => Promise<TaskConDati>
  modificaTask: (taskId: string, input: ModificaTaskInput) => Promise<TaskConDati>
  completaTaskAction: (taskId: string, liberaFuture: boolean) => Promise<void>
  archivaTaskAction: (taskId: string) => Promise<void>
  eliminaAllocazioneAction: (allocId: string, taskId: string) => Promise<void>
  // Ottieni task con dati per id
  getTaskConDati: (taskId: string) => TaskConDati | null
}

const TaskDataContext = createContext<TaskDataContextValue | null>(null)

export function TaskDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TaskDataState>({ tasks: [], loading: false, error: null })

  const carica = useCallback(async (opts: { personaId?: string; clienteId?: string; includiCompletati?: boolean }) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const tasks = await fetchTaskConDati(opts)
      setState({ tasks, loading: false, error: null })
    } catch (e: any) {
      setState(s => ({ ...s, loading: false, error: e.message }))
    }
  }, [])

  const creaTask = useCallback(async (input: NuovoTaskInput): Promise<TaskConDati> => {
    const task = await creaTaskAtomico(input)
    setState(s => ({ ...s, tasks: [task, ...s.tasks] }))
    return task
  }, [])

  const modificaTask = useCallback(async (taskId: string, input: ModificaTaskInput): Promise<TaskConDati> => {
    const existing = state.tasks.find(t => t.id === taskId)
    if (!existing) throw new Error(`Task ${taskId} non trovato in store`)
    const updated = await modificaTaskAtomico(taskId, input, existing.assegnazioni, existing.allocazioni)
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === taskId ? updated : t) }))
    return updated
  }, [state.tasks])

  const completaTaskAction = useCallback(async (taskId: string, liberaFuture: boolean) => {
    const existing = state.tasks.find(t => t.id === taskId)
    if (!existing) throw new Error(`Task ${taskId} non trovato in store`)
    const oggi = new Date().toISOString().split('T')[0]
    const future = existing.allocazioni.filter(a => a.data_inizio > oggi)
    await completaTask(taskId, future, liberaFuture)
    setState(s => ({
      ...s,
      tasks: s.tasks.map(t => t.id === taskId
        ? { ...t, stato: 'completato', completed_at: new Date().toISOString(),
            allocazioni: liberaFuture ? t.allocazioni.filter(a => a.data_inizio <= oggi) : t.allocazioni }
        : t)
    }))
  }, [state.tasks])

  const archivaTaskAction = useCallback(async (taskId: string) => {
    await archivaTask(taskId)
    setState(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== taskId) }))
  }, [])

  const eliminaAllocazioneAction = useCallback(async (allocId: string, taskId: string) => {
    await eliminaAllocazione(allocId)
    setState(s => ({
      ...s,
      tasks: s.tasks.map(t => {
        if (t.id !== taskId) return t
        const nuoveAlloc = t.allocazioni.filter(a => a.id !== allocId)
        const orePian = nuoveAlloc.reduce((sum, a) => sum + a.ore, 0)
        return { ...t, allocazioni: nuoveAlloc, ore_pianificate_totali: orePian,
          ore_da_pianificare: Math.max(0, t.ore_assegnate_totali - orePian) }
      })
    }))
  }, [])

  const getTaskConDati = useCallback((taskId: string) => {
    return state.tasks.find(t => t.id === taskId) ?? null
  }, [state.tasks])

  return (
    <TaskDataContext.Provider value={{
      ...state, carica, creaTask, modificaTask, completaTaskAction,
      archivaTaskAction, eliminaAllocazioneAction, getTaskConDati
    }}>
      {children}
    </TaskDataContext.Provider>
  )
}

export function useTaskData() {
  const ctx = useContext(TaskDataContext)
  if (!ctx) throw new Error('useTaskData must be used within TaskDataProvider')
  return ctx
}
