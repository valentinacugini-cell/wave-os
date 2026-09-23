import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginView() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          setError('Email o password non corretti.')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Account non confermato. Controlla la tua email.')
        } else {
          setError('Errore di accesso. Riprova.')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword() {
    if (!email.trim()) {
      setError('Inserisci la tua email per reimpostare la password.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (resetError) {
      setError('Errore nell\'invio della email di reset. Contatta un amministratore.')
    } else {
      setError(null)
      alert(`Email di reset inviata a ${email}. Controlla la tua casella.`)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: '#F5F4EF' }}>
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-sm shadow-sm">
        {/* Logo/Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3"
            style={{ background: '#1A1A2E' }}>
            <span className="text-xs font-bold" style={{ color: '#7DF5DF' }}>W</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Wave OS</h1>
          <p className="text-xs text-gray-400 mt-1">Accedi al tuo account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nome@wavemarketing.it"
              required
              autoComplete="email"
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-200 outline-none focus:border-teal-400 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-200 outline-none focus:border-teal-400 transition-colors"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: '#1A1A2E', color: '#7DF5DF' }}
          >
            {loading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={handleResetPassword}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Password dimenticata?
          </button>
        </div>

        <p className="text-xs text-gray-300 text-center mt-6">
          Gli account sono gestiti dall'amministratore Wave.
        </p>
      </div>
    </div>
  )
}
