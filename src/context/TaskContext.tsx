import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Task } from '../types'

interface TaskContextValue {
  taskEdits: Record<string, Partial<Task>>
  updateTask: (id: string, updates: Partial<Task>) => void
  getTask: (task: Task) => Task
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
  const [taskEdits, setTaskEdits] = useState<Record<string, Partial<Task>>>({})

  function updateTask(id: string, updates: Partial<Task>) {
    setTaskEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...updates } }))
  }

  function getTask(task: Task): Task {
    return { ...task, ...(taskEdits[task.id] ?? {}) }
  }

  return (
    <TaskContext.Provider value={{ taskEdits, updateTask, getTask }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTaskContext() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTaskContext must be used within TaskProvider')
  return ctx
}
