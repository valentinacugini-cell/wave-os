import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Task } from '../types'
import { sbPost, sbPatch, sbDelete } from '../lib/supabase'

interface TaskContextValue {
  taskEdits: Record<string, Partial<Task>>
  taskEliminati: Set<string>
  updateTask: (id: string, updates: Partial<Task>) => void
  eliminaTask: (ids: string[]) => void
  getTask: (task: Task) => Task
  isEliminato: (id: string) => boolean
  addTask: (task: Omit<Task, 'id'> & { id?: string }) => Promise<string>
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
  const [taskEdits, setTaskEdits] = useState<Record<string, Partial<Task>>>({})
  const [taskEliminati, setTaskEliminati] = useState<Set<string>>(new Set())

  async function updateTask(id: string, updates: Partial<Task>) {
    // Aggiorna stato locale immediatamente
    setTaskEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...updates } }))
    // Scrive su Supabase in background
    try {
      await sbPatch('tasks', id, updates)
    } catch(e) {
      console.error('updateTask Supabase:', e)
    }
  }

  async function eliminaTask(ids: string[]) {
    setTaskEliminati(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.add(id))
      return next
    })
    // Elimina su Supabase in background
    for (const id of ids) {
      try {
        await sbDelete('tasks', id)
      } catch(e) {
        console.error('eliminaTask Supabase:', e)
      }
    }
  }

  async function addTask(taskData: Omit<Task, 'id'> & { id?: string }): Promise<string> {
    const id = taskData.id ?? `task_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
    const task = { ...taskData, id }
    try {
      await sbPost('tasks', task)
    } catch(e) {
      console.error('addTask Supabase:', e)
    }
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
