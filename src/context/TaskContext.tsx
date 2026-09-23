import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Task } from '../types'
import { sbPost, sbPatch, sbDelete } from '../lib/supabase'

interface TaskContextValue {
  taskEdits: Record<string, Partial<Task>>
  taskEliminati: Set<string>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  eliminaTask: (ids: string[]) => Promise<void>
  getTask: (task: Task) => Task
  isEliminato: (id: string) => boolean
  addTask: (task: Omit<Task, 'id'> & { id?: string }) => Promise<string>
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
  const [taskEdits, setTaskEdits] = useState<Record<string, Partial<Task>>>({})
  const [taskEliminati, setTaskEliminati] = useState<Set<string>>(new Set())

  // updateTask — aggiorna lo stato locale SOLO dopo conferma DB
  async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
    await sbPatch('tasks', id, updates)
    // Aggiorna stato locale solo se DB ha confermato (sbPatch lancia eccezione in caso di errore)
    setTaskEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...updates } }))
  }

  // eliminaTask — soft delete tramite archived_at, NON DELETE fisico
  // Lo stato operativo NON diventa 'archiviato' — il task rimane con il suo stato attuale
  // ma viene filtrato dalle viste tramite archived_at IS NOT NULL
  async function eliminaTask(ids: string[]): Promise<void> {
    const archivedAt = new Date().toISOString()
    for (const id of ids) {
      await sbPatch('tasks', id, { archived_at: archivedAt })
      // Aggiorna stato locale solo dopo conferma DB
      setTaskEliminati(prev => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
    }
  }

  // addTask — aggiunge task solo se DB conferma
  async function addTask(taskData: Omit<Task, 'id'> & { id?: string }): Promise<string> {
    const id = taskData.id ?? `task_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
    const task = { ...taskData, id }
    await sbPost('tasks', task)
    // Nessuna modifica locale ottimistica — il seed viene ricaricato o il chiamante gestisce
    return id
  }

  function getTask(task: Task): Task {
    return { ...task, ...(taskEdits[task.id] ?? {}) }
  }

  function isEliminato(id: string): boolean {
    return taskEliminati.has(id)
  }

  return (
    <TaskContext.Provider value={{
      taskEdits, taskEliminati, updateTask, eliminaTask, getTask, isEliminato, addTask
    }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTaskContext() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTaskContext must be used within TaskProvider')
  return ctx
}
