'use client'

import { useEffect, useState } from 'react'
import { useTheme } from './ThemeProvider'
import { createSupabaseBrowserClient } from '@/lib/supabase'

type HeaderProps = {
  lang?: 'fr' | 'en'
  onLangChange?: (lang: 'fr' | 'en') => void
  user?: any
  username?: string | null
  onLogout?: () => void
}

export default function Header({ lang, onLangChange, user: userProp, username: usernameProp, onLogout: onLogoutProp }: HeaderProps) {
  const { theme, toggle } = useTheme()
  const [user, setUser] = useState<any>(userProp || null)
  const [username, setUsername] = useState<string | null>(usernameProp || null)
  const [ready, setReady] = useState(false)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    if (userProp !== undefined) {
      setReady(true)
      return
    }
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', data.user.id)
          .single()
        if (profile) setUsername(profile.username)
      }
      setReady(true)
    })
  }, [])

  async function handleLogout() {
    if (onLogoutProp) {
      onLogoutProp()
    } else {
      await supabase.auth.signOut()
      setUser(null)
      setUsername(null)
      window.location.href = '/game'
    }
  }

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 32px',
      borderBottom: '1px solid var(--border)',
      backgroundColor: 'var(--bg)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {/* Logo */}
      <a href="/game" style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 22,
        color: 'var(--text)',
        letterSpacing: '-0.5px',
        textDecoration: 'none',
      }}>
        Wikifinder
      </a>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 20 }}>

        {/* Toggle langue */}
        {onLangChange && (
          <div style={{ display: 'flex', gap: 4 }}>
            {(['fr', 'en'] as const).map(l => (
              <button key={l} onClick={() => onLangChange(l)} style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                backgroundColor: lang === l ? 'var(--accent)' : 'transparent',
                color: lang === l ? 'white' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: '0.2s',
              }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Zone utilisateur — placeholder pendant le chargement */}
        {!ready ? (
          <div style={{ width: 120, height: 20, backgroundColor: 'var(--border)', borderRadius: 4, opacity: 0.4 }} />
        ) : user ? (
          <>
            <a href="/history" style={{ fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>
              Historique
            </a>
            <a href="/leaderboard" style={{ fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>
              Classement
            </a>
            <a href="/profile" style={{ fontSize: 14, color: 'var(--text)', textDecoration: 'none', fontWeight: 600 }}>
              {username || user.email}
            </a>
            <button onClick={handleLogout} style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}>
              Déconnexion
            </button>
          </>
        ) : (
          <a href="/auth/login" style={{
            fontSize: 14,
            color: 'var(--text)',
            fontWeight: 600,
            padding: '6px 16px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            textDecoration: 'none',
          }}>
            Connexion
          </a>
        )}

        {/* Toggle thème */}
        <button onClick={toggle} style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          cursor: 'pointer',
          transition: '0.2s',
        }}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </nav>
    </header>
  )
}