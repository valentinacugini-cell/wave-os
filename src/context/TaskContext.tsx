import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Task } from '../types'

interface TaskContextValue {
  taskEdits: Record<string, Partial<Task>>
  taskEliminati: Set<string>
  updateTask: (id: string, updates: Partial<Task>) => void
  eliminaTask: (ids: string[]) => void
  getTask: (task: Task) => Task
  isEliminato: (id: string) => boolean
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
  const [taskEdits, setTaskEdits] = useState<Record<string, Partial<Task>>>({})
  const [taskEliminati, setTaskEliminati] = useState<Set<string>>(new Set())

  function updateTask(id: string, updates: Partial<Task>) {
    setTaskEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...updates } }))
  }

  function eliminaTask(ids: string[]) {
    setTaskEliminati(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.add(id))
      return next
    })
  }

  function getTask(task: Task): Task {
    return { ...task, ...(taskEdits[task.id] ?? {}) }
  }

  function isEliminato(id: string): boolean {
    return taskEliminati.has(id)
  }

  return (
    <TaskContext.Provider value={{ taskEdits, taskEliminati, updateTask, eliminaTask, getTask, isEliminato }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTaskContext() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTaskContext must be used within TaskProvider')
  return ctx
}
