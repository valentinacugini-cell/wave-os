import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Cliente, Contatto } from '../types'

interface ClienteEdit {
  cliente?: Partial<Cliente>
  contatti?: Contatto[]
  noteRinnovo?: string
}

interface ClienteContextValue {
  clienteEdits: Record<string, ClienteEdit>
  updateCliente: (id: string, updates: Partial<Cliente>) => void
  updateContatti: (id: string, contatti: Contatto[]) => void
  updateNoteRinnovo: (id: string, note: string) => void
  getCliente: (cliente: Cliente) => Cliente
  getContatti: (clienteId: string, defaultContatti: Contatto[]) => Contatto[]
  getNoteRinnovo: (clienteId: string, defaultNote?: string) => string | undefined
  nuoviClienti: Cliente[]
  addCliente: (cliente: Cliente) => void
}

const ClienteContext = createContext<ClienteContextValue | null>(null)

export function ClienteProvider({ children }: { children: ReactNode }) {
  const [clienteEdits, setClienteEdits] = useState<Record<string, ClienteEdit>>({})
  const [nuoviClienti, setNuoviClienti] = useState<Cliente[]>([])

  function updateCliente(id: string, updates: Partial<Cliente>) {
    setClienteEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], cliente: { ...(prev[id]?.cliente ?? {}), ...updates } }
    }))
  }

  function updateContatti(id: string, contatti: Contatto[]) {
    setClienteEdits(prev => ({ ...prev, [id]: { ...prev[id], contatti } }))
  }

  function updateNoteRinnovo(id: string, note: string) {
    setClienteEdits(prev => ({ ...prev, [id]: { ...prev[id], noteRinnovo: note } }))
  }

  function getCliente(cliente: Cliente): Cliente {
    return { ...cliente, ...(clienteEdits[cliente.id]?.cliente ?? {}) }
  }

  function getContatti(clienteId: string, defaultContatti: Contatto[]): Contatto[] {
    return clienteEdits[clienteId]?.contatti ?? defaultContatti
  }

  function getNoteRinnovo(clienteId: string, defaultNote?: string): string | undefined {
    return clienteEdits[clienteId]?.noteRinnovo ?? defaultNote
  }

  function addCliente(cliente: Cliente) {
    setNuoviClienti(prev => [...prev, cliente])
  }

  return (
    <ClienteContext.Provider value={{
      clienteEdits, updateCliente, updateContatti, updateNoteRinnovo,
      getCliente, getContatti, getNoteRinnovo, nuoviClienti, addCliente
    }}>
      {children}
    </ClienteContext.Provider>
  )
}

export function useClienteContext() {
  const ctx = useContext(ClienteContext)
  if (!ctx) throw new Error('useClienteContext must be used within ClienteProvider')
  return ctx
}
