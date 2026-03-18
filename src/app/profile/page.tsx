'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import Header from '@/components/Header'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isEmailUser, setIsEmailUser] = useState(false)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.href = '/auth/login'
        return
      }
      setUser(data.user)
      const provider = data.user.app_metadata?.provider
      setIsEmailUser(provider === 'email')

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', data.user.id)
        .single()

      if (profile) setUsername(profile.username || '')
    })
  }, [])

  async function updateUsername() {
    setLoading(true)
    setMessage('')
    setError('')
    const { error } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', user.id)
    if (error) setError(error.message)
    else setMessage('Pseudo mis à jour !')
    setLoading(false)
  }

  async function updatePassword() {
    setLoading(true)
    setMessage('')
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      setLoading(false)
      return
    }
    if (newPassword.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.')
      setLoading(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setError(error.message)
    else {
      setMessage('Mot de passe mis à jour !')
      setNewPassword('')
      setConfirmPassword('')
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    fontSize: 15,
    boxSizing: 'border-box' as const,
    marginBottom: 12,
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'var(--font-sans)',
  }

  const cardStyle = {
    marginBottom: 20,
    padding: 24,
    border: '1px solid var(--border)',
    borderRadius: 10,
    backgroundColor: 'var(--surface)',
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        Chargement...
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 20px' }}>

        <h1 style={{ margin: '0 0 28px 0', fontSize: 28, color: 'var(--text)' }}>Mon profil</h1>

        {message && (
          <div style={{ padding: 12, borderRadius: 6, backgroundColor: 'var(--revealed)', border: '1px solid var(--accent)', color: 'var(--accent)', marginBottom: 16, fontSize: 14 }}>
            ✓ {message}
          </div>
        )}
        {error && (
          <div style={{ padding: 12, borderRadius: 6, backgroundColor: 'var(--bg-secondary)', border: '1px solid #c62828', color: '#c62828', marginBottom: 16, fontSize: 14 }}>
            ✗ {error}
          </div>
        )}

        {/* Pseudo */}
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: 4, fontSize: 17, color: 'var(--text)' }}>Pseudo</h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
            Affiché sur le leaderboard
          </div>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Ton pseudo"
            style={inputStyle}
          />
          <button
            onClick={updateUsername}
            disabled={loading || !username.trim()}
            style={{
              padding: '9px 20px',
              borderRadius: 6,
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              cursor: loading || !username.trim() ? 'default' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: loading || !username.trim() ? 0.6 : 1,
            }}
          >
            Sauvegarder
          </button>
        </div>

        {/* Mot de passe */}
        {isEmailUser && (
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: 17, color: 'var(--text)' }}>Changer le mot de passe</h2>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              style={inputStyle}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirmer le mot de passe"
              style={inputStyle}
            />
            <button
              onClick={updatePassword}
              disabled={loading || !newPassword}
              style={{
                padding: '9px 20px',
                borderRadius: 6,
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                cursor: loading || !newPassword ? 'default' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                opacity: loading || !newPassword ? 0.6 : 1,
              }}
            >
              Mettre à jour
            </button>
          </div>
        )}

        {/* Infos compte */}
        <div style={{ ...cardStyle, backgroundColor: 'var(--bg-secondary)' }}>
          <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: 17, color: 'var(--text)' }}>Informations</h2>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 2.2 }}>
            <div><span style={{ color: 'var(--text)', fontWeight: 500 }}>Email :</span> {user.email}</div>
            <div><span style={{ color: 'var(--text)', fontWeight: 500 }}>Connexion :</span> {isEmailUser ? 'Email / mot de passe' : 'Google'}</div>
            <div><span style={{ color: 'var(--text)', fontWeight: 500 }}>Membre depuis :</span> {new Date(user.created_at).toLocaleDateString('fr-FR')}</div>
          </div>
        </div>

      </div>
    </div>
  )
}