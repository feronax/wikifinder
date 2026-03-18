'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

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

      // Charge le profil
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

  if (!user) return <div style={{ padding: 40 }}>Chargement...</div>

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 32, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ margin: 0 }}>Mon profil</h1>
        <a href="/game" style={{ color: '#1a1a1a', textDecoration: 'none', fontWeight: 'bold' }}>← Jouer</a>
      </div>

      {message && (
        <div style={{ padding: 12, borderRadius: 6, backgroundColor: '#e8f5e9', color: '#2e7d32', marginBottom: 16, fontSize: 14 }}>
          ✓ {message}
        </div>
      )}
      {error && (
        <div style={{ padding: 12, borderRadius: 6, backgroundColor: '#ffebee', color: '#c62828', marginBottom: 16, fontSize: 14 }}>
          ✗ {error}
        </div>
      )}

      {/* Pseudo */}
      <div style={{ marginBottom: 32, padding: 24, border: '1px solid #e0e0e0', borderRadius: 8 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Pseudo</h2>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
          Affiché sur le leaderboard
        </div>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Ton pseudo"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box', marginBottom: 12 }}
        />
        <button
          onClick={updateUsername}
          disabled={loading || !username.trim()}
          style={{ padding: '8px 20px', borderRadius: 6, backgroundColor: '#1a1a1a', color: 'white', border: 'none', cursor: 'pointer', fontSize: 15 }}
        >
          Sauvegarder
        </button>
      </div>

      {/* Mot de passe — uniquement pour les comptes email */}
      {isEmailUser && (
        <div style={{ marginBottom: 32, padding: 24, border: '1px solid #e0e0e0', borderRadius: 8 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Changer le mot de passe</h2>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Nouveau mot de passe"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box', marginBottom: 10 }}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirmer le mot de passe"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box', marginBottom: 12 }}
          />
          <button
            onClick={updatePassword}
            disabled={loading || !newPassword}
            style={{ padding: '8px 20px', borderRadius: 6, backgroundColor: '#1a1a1a', color: 'white', border: 'none', cursor: 'pointer', fontSize: 15 }}
          >
            Mettre à jour
          </button>
        </div>
      )}

      {/* Infos compte */}
      <div style={{ padding: 24, border: '1px solid #e0e0e0', borderRadius: 8, backgroundColor: '#f9f9f9' }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Informations</h2>
        <div style={{ fontSize: 14, color: '#666', lineHeight: 2 }}>
          <div><strong>Email :</strong> {user.email}</div>
          <div><strong>Connexion :</strong> {isEmailUser ? 'Email / mot de passe' : 'Google'}</div>
          <div><strong>Membre depuis :</strong> {new Date(user.created_at).toLocaleDateString('fr-FR')}</div>
        </div>
      </div>
    </div>
  )
}