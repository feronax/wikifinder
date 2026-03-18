'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createSupabaseBrowserClient()

  async function handleEmailAuth() {
    setLoading(true)
    setMessage('')

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
      })
      if (error) setMessage(error.message)
      else setMessage('Vérifie ta boîte mail pour confirmer ton compte !')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
      else window.location.href = '/game'
    }
    setLoading(false)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 32, fontFamily: 'sans-serif' }}>
      <h1 style={{ marginBottom: 8 }}>Wikifinder</h1>
      <h2 style={{ marginBottom: 24, fontWeight: 'normal', color: '#555' }}>
        {mode === 'login' ? 'Connexion' : 'Créer un compte'}
      </h2>

      {/* Google */}
      <button onClick={handleGoogle} style={{
        width: '100%', padding: '10px 16px', marginBottom: 16,
        border: '1px solid #ddd', borderRadius: 6, fontSize: 15,
        cursor: 'pointer', backgroundColor: 'white', display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: 8
      }}>
        <img src="https://www.google.com/favicon.ico" width={18} height={18} alt="" />
        Continuer avec Google
      </button>

      <div style={{ textAlign: 'center', color: '#aaa', marginBottom: 16 }}>ou</div>

      {/* Email */}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', marginBottom: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box' }}
      />
      <input
        type="password"
        placeholder="Mot de passe"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
        style={{ width: '100%', padding: '10px 12px', marginBottom: 16, borderRadius: 6, border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box' }}
      />

      <button onClick={handleEmailAuth} disabled={loading} style={{
        width: '100%', padding: '10px 16px', borderRadius: 6,
        backgroundColor: '#1a1a1a', color: 'white', fontSize: 15,
        border: 'none', cursor: 'pointer', marginBottom: 16
      }}>
        {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
      </button>

      {message && (
        <div style={{ padding: 12, borderRadius: 6, backgroundColor: '#f0f9ff', color: '#0369a1', fontSize: 14, marginBottom: 16 }}>
          {message}
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 14, color: '#666' }}>
        {mode === 'login' ? (
          <>Pas encore de compte ? <button onClick={() => setMode('register')} style={{ background: 'none', border: 'none', color: '#1a1a1a', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}>S'inscrire</button></>
        ) : (
          <>Déjà un compte ? <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: '#1a1a1a', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}>Se connecter</button></>
        )}
      </div>
    </div>
  )
}