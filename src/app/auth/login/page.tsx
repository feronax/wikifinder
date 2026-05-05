'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import NewDesignHeader from '@/components/game/new/NewDesignHeader'

const copy = {
  fr: {
    taglineLogin: 'Connecte-toi pour sauvegarder tes parties',
    taglineRegister: 'Crée ton compte gratuitement',
    google: 'Continuer avec Google',
    or: 'ou',
    passwordPlaceholder: 'Mot de passe',
    loading: 'Chargement...',
    login: 'Se connecter',
    register: "S'inscrire",
    confirmEmail: 'Vérifie ta boîte mail pour confirmer ton compte !',
    noAccount: 'Pas encore de compte ?',
    hasAccount: 'Déjà un compte ?',
  },
  en: {
    taglineLogin: 'Sign in to save your games',
    taglineRegister: 'Create your free account',
    google: 'Continue with Google',
    or: 'or',
    passwordPlaceholder: 'Password',
    loading: 'Loading...',
    login: 'Sign in',
    register: 'Sign up',
    confirmEmail: 'Check your inbox to confirm your account!',
    noAccount: 'No account yet?',
    hasAccount: 'Already have an account?',
  },
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState<'fr' | 'en'>('fr')

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const l = p.get('lang')
    if (l === 'en' || l === 'fr') setLang(l)
  }, [])

  const supabase = createSupabaseBrowserClient()
  const t = copy[lang]

  async function handleEmailAuth() {
    setLoading(true)
    setMessage('')
    if (mode === 'register') {
      // Bug 3 fix: include ?lang= in emailRedirectTo so the auth callback
      // receives the language preference after email confirmation.
      const langSuffix = lang === 'en' ? '?lang=en' : ''
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback${langSuffix}` }
      })
      if (error) setMessage(error.message)
      else setMessage(t.confirmEmail)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
      else window.location.href = lang === 'en' ? '/game?lang=en' : '/game'
    }
    setLoading(false)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback${lang === 'en' ? '?lang=en' : ''}`
      }
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
      <NewDesignHeader />
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
            {mode === 'login' ? t.taglineLogin : t.taglineRegister}
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
            {t.google}
          </button>

          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 20, fontSize: 13 }}>{t.or}</div>

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
            placeholder={t.passwordPlaceholder}
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
            {loading ? t.loading : mode === 'login' ? t.login : t.register}
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
              <>{t.noAccount}{' '}
                <button onClick={() => setMode('register')} style={{
                  background: 'none', border: 'none',
                  color: 'var(--accent)', cursor: 'pointer',
                  fontWeight: 600, fontSize: 14,
                  fontFamily: 'var(--font-sans)',
                }}>
                  {t.register}
                </button>
              </>
            ) : (
              <>{t.hasAccount}{' '}
                <button onClick={() => setMode('login')} style={{
                  background: 'none', border: 'none',
                  color: 'var(--accent)', cursor: 'pointer',
                  fontWeight: 600, fontSize: 14,
                  fontFamily: 'var(--font-sans)',
                }}>
                  {t.login}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
