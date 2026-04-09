'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import Header from '@/components/Header'
import Loader from '@/components/Loader'

type Stats = {
  totalGames: number
  totalWins: number
  winRate: number
  avgGuesses: number
  bestScore: number
  avgScore: number
  streak: number
  bestStreak: number
  distribution: Record<string, number>
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isEmailUser, setIsEmailUser] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
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

      fetch('/api/stats').then(r => r.json()).then(d => setStats(d))

      // Check push notification support and current state
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        setPushSupported(true)
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        setPushEnabled(!!sub)
      }
    })
  }, [])

  async function updateUsername() {
    setLoading(true)
    setMessage('')
    setError('')
    const trimmed = username.trim()
    if (!trimmed) { setLoading(false); return }

    // Vérifie l'unicité du pseudo côté client
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', trimmed)
      .neq('id', user.id)
      .limit(1)

    if (existing && existing.length > 0) {
      setError('Ce pseudo est déjà pris.')
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
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

  async function togglePush() {
    setPushLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      if (pushEnabled) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
        setPushEnabled(false)
      } else {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        })
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        })
        setPushEnabled(true)
      }
    } catch {
      setError('Impossible d\'activer les notifications. Vérifie les permissions de ton navigateur.')
    }
    setPushLoading(false)
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

  const statValueStyle = {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--accent)',
    lineHeight: 1,
  }

  const statLabelStyle = {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 6,
    fontWeight: 500,
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader />
      </div>
    </div>
  )

  const maxDistribution = stats ? Math.max(...Object.values(stats.distribution), 1) : 1

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 20px' }}>

        <h1 style={{ margin: '0 0 28px 0', fontSize: 28, color: 'var(--text)' }}>Mon profil</h1>

        {message && (
          <div style={{ padding: 12, borderRadius: 6, backgroundColor: 'var(--revealed)', border: '1px solid var(--accent)', color: 'var(--accent)', marginBottom: 16, fontSize: 14 }}>
            {message}
          </div>
        )}
        {error && (
          <div style={{ padding: 12, borderRadius: 6, backgroundColor: 'var(--bg-secondary)', border: '1px solid #c62828', color: '#c62828', marginBottom: 16, fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Pseudo + Notifications */}
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

          {pushSupported && (
            <>
              <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '20px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Notifications</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    Rappel quotidien à 18h30
                  </div>
                </div>
                <button
                  onClick={togglePush}
                  disabled={pushLoading}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 6,
                    backgroundColor: pushEnabled ? 'var(--accent)' : 'var(--border)',
                    color: pushEnabled ? 'white' : 'var(--text-muted)',
                    border: 'none',
                    cursor: pushLoading ? 'default' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    opacity: pushLoading ? 0.6 : 1,
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                >
                  {pushLoading ? '...' : pushEnabled ? 'Activées' : 'Activer'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Statistiques */}
        {stats && stats.totalGames > 0 && (
          <>
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 17, color: 'var(--text)' }}>Statistiques</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={statValueStyle}>{stats.totalGames}</div>
                  <div style={statLabelStyle}>Parties jouées</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={statValueStyle}>{stats.winRate}%</div>
                  <div style={statLabelStyle}>Taux de victoire</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={statValueStyle}>{stats.avgGuesses}</div>
                  <div style={statLabelStyle}>Moy. tentatives</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={statValueStyle}>{stats.bestScore.toLocaleString()}</div>
                  <div style={statLabelStyle}>Meilleur score</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={statValueStyle}>{stats.avgScore.toLocaleString()}</div>
                  <div style={statLabelStyle}>Score moyen</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={statValueStyle}>{stats.totalWins}</div>
                  <div style={statLabelStyle}>Victoires</div>
                </div>
              </div>
            </div>

            {/* Streak */}
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: 17, color: 'var(--text)' }}>Streak</h2>
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                    {stats.streak > 0 ? `${stats.streak} 🔥` : '0'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Streak actuel</div>
                </div>
                <div style={{ width: 1, backgroundColor: 'var(--border)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                    {stats.bestStreak > 0 ? `${stats.bestStreak} ⭐` : '0'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Meilleur streak</div>
                </div>
              </div>
            </div>

            {/* Distribution */}
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 17, color: 'var(--text)' }}>Distribution des tentatives</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(stats.distribution).map(([range, count]) => (
                  <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 55,
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textAlign: 'right',
                      flexShrink: 0,
                    }}>
                      {range}
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: 28 }}>
                      <div style={{
                        height: '100%',
                        borderRadius: 4,
                        backgroundColor: count > 0 ? 'var(--accent)' : 'var(--border)',
                        width: `${Math.max((count / maxDistribution) * 100, count > 0 ? 8 : 2)}%`,
                        transition: 'width 0.5s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: 8,
                      }}>
                        {count > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>
                            {count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

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

        {/* Supprimer le compte */}
        <div style={{ marginTop: 20, marginBottom: 40, textAlign: 'center' }}>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{
              background: 'none', border: 'none', color: '#e53e3e',
              fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Supprimer mon compte
          </button>
        </div>

        {/* Modal de confirmation */}
        {showDeleteModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: 20,
          }}
            onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                backgroundColor: 'var(--surface)', borderRadius: 12,
                padding: 28, maxWidth: 420, width: '100%',
                border: '1px solid var(--border)',
              }}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#e53e3e' }}>
                Supprimer mon compte
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
                Cette action est irréversible. Toutes tes données seront supprimées :
                parties, scores, streaks, statistiques et profil.
              </p>
              <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 12, fontWeight: 500 }}>
                Tape <strong>Supprimer</strong> pour confirmer :
              </p>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Supprimer"
                style={{
                  ...inputStyle,
                  border: '1px solid #e53e3e',
                  marginBottom: 16,
                }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
                  style={{
                    padding: '9px 20px', borderRadius: 6, border: '1px solid var(--border)',
                    backgroundColor: 'var(--surface)', color: 'var(--text)',
                    fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={async () => {
                    if (deleteConfirm !== 'Supprimer') return
                    setDeleting(true)
                    const res = await fetch('/api/account/delete', { method: 'DELETE' })
                    if (res.ok) {
                      await supabase.auth.signOut()
                      window.location.href = '/'
                    } else {
                      setError('Erreur lors de la suppression du compte.')
                      setShowDeleteModal(false)
                      setDeleting(false)
                    }
                  }}
                  disabled={deleteConfirm !== 'Supprimer' || deleting}
                  style={{
                    padding: '9px 20px', borderRadius: 6, border: 'none',
                    backgroundColor: deleteConfirm === 'Supprimer' ? '#e53e3e' : 'var(--border)',
                    color: 'white', fontSize: 14, fontWeight: 600,
                    cursor: deleteConfirm === 'Supprimer' && !deleting ? 'pointer' : 'default',
                    opacity: deleteConfirm === 'Supprimer' && !deleting ? 1 : 0.5,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {deleting ? 'Suppression...' : 'Supprimer définitivement'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
