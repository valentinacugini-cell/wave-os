import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, fetchTeamMemberByAuthId } from '../lib/supabase'
import { Persona } from '../types'

export interface AuthState {
  user: User | null
  session: Session | null
  teamMember: Persona | null
  loading: boolean
  // true quando l'utente è autenticato ma non ha un team member associato
  noTeamAssociation: boolean
}

export function useAuth(): AuthState & { logout: () => Promise<void> } {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [teamMember, setTeamMember] = useState<Persona | null>(null)
  const [loading, setLoading] = useState(true)
  const [noTeamAssociation, setNoTeamAssociation] = useState(false)

  async function resolveTeamMember(u: User | null) {
    if (!u) {
      setTeamMember(null)
      setNoTeamAssociation(false)
      return
    }
    try {
      const member = await fetchTeamMemberByAuthId(u.id)
      setTeamMember(member)
      setNoTeamAssociation(member === null)
    } catch {
      setTeamMember(null)
      setNoTeamAssociation(true)
    }
  }

  useEffect(() => {
    // Recupera la sessione corrente (ripristino dopo refresh)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      resolveTeamMember(s?.user ?? null).finally(() => setLoading(false))
    })

    // Ascolta i cambi di stato auth (login, logout, refresh token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      resolveTeamMember(s?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
  }

  return { user, session, teamMember, loading, noTeamAssociation, logout }
}
