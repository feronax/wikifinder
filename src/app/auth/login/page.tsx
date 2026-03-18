'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import Header from '@/components/Header'

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

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    marginBottom: 10,
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: 15,
    boxSizing: 'border-box' as const,
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div style={{ maxWidth: 400, margin: '60px auto', padding: '0 20px' }}>

        {/* Logo + titre */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 32,
            color: 'var(--text)',
            marginBottom: 8,
          }}>
            Wikifinder
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
            {mode === 'login' ? 'Connecte-toi pour sauvegarder tes parties' : 'Crée ton compte gratuitement'}
          </p>
        </div>

        <div style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 28,
        }}>

          {/* Google */}
          <button onClick={handleGoogle} style={{
            width: '100%',
            padding: '11px 16px',
            marginBottom: 20,
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 15,
            cursor: 'pointer',
            backgroundColor: 'var(--bg)',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
          }}>
            <img src="https://www.google.com/favicon.ico" width={18} height={18} alt="" />
            Continuer avec Google
          </button>

          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 20, fontSize: 13 }}>ou</div>

          {/* Email */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
            style={{ ...inputStyle, marginBottom: 16 }}
          />

          <button onClick={handleEmailAuth} disabled={loading} style={{
            width: '100%',
            padding: '11px 16px',
            borderRadius: 8,
            backgroundColor: 'var(--accent)',
            color: 'white',
            fontSize: 15,
            fontWeight: 600,
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
            marginBottom: 16,
            fontFamily: 'var(--font-sans)',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>

          {message && (
            <div style={{
              padding: 12,
              borderRadius: 6,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: 14,
              marginBottom: 16,
            }}>
              {message}
            </div>
          )}

          <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
            {mode === 'login' ? (
              <>Pas encore de compte ?{' '}
                <button onClick={() => setMode('register')} style={{
                  background: 'none', border: 'none',
                  color: 'var(--accent)', cursor: 'pointer',
                  fontWeight: 600, fontSize: 14,
                  fontFamily: 'var(--font-sans)',
                }}>
                  S'inscrire
                </button>
              </>
            ) : (
              <>Déjà un compte ?{' '}
                <button onClick={() => setMode('login')} style={{
                  background: 'none', border: 'none',
                  color: 'var(--accent)', cursor: 'pointer',
                  fontWeight: 600, fontSize: 14,
                  fontFamily: 'var(--font-sans)',
                }}>
                  Se connecter
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}