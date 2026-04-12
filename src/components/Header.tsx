'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTheme } from './ThemeProvider'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useIsMobile } from '@/lib/utils'

type HeaderProps = {
  lang?: 'fr' | 'en'
  onLangChange?: (lang: 'fr' | 'en') => void
  user?: any
  username?: string | null
  onLogout?: () => void
}

const headerTranslations = {
  fr: {
    ranked: 'Classé',
    history: 'Historique',
    leaderboard: 'Classement',
    login: 'Connexion',
    loginMobile: 'Se connecter',
    logout: 'Déconnexion',
    myProfile: 'Mon Profil',
    darkMode: 'Passer au mode sombre',
    lightMode: 'Passer au mode clair',
  },
  en: {
    ranked: 'Ranked',
    history: 'History',
    leaderboard: 'Leaderboard',
    login: 'Login',
    loginMobile: 'Login',
    logout: 'Logout',
    myProfile: 'My Profile',
    darkMode: 'Switch to dark mode',
    lightMode: 'Switch to light mode',
  },
}

export default function Header({ lang, onLangChange, user: userProp, username: usernameProp, onLogout: onLogoutProp }: HeaderProps) {
  const { theme, toggle } = useTheme()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(userProp || null)
  const [username, setUsername] = useState<string | null>(usernameProp || null)
  const [ready, setReady] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [streak, setStreak] = useState(0)
  const isMobile = useIsMobile()
  const supabase = createSupabaseBrowserClient()
  const t = headerTranslations[lang || 'fr']

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
        fetch('/api/game/streak').then(r => r.json()).then(d => setStreak(d.streak || 0))
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

  useEffect(() => {
    if (!isMobile) setIsMenuOpen(false)
  }, [isMobile])

  return (
    <header style={{ position: 'relative', zIndex: 100 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '12px 20px' : '16px 32px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg)',
      }}>
        <a href="/game" style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 22,
          color: 'var(--text)',
          letterSpacing: '-0.5px',
          textDecoration: 'none',
        }}>
          Wikifinder
        </a>

        {isMobile && (
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{ background: 'none', border: 'none', fontSize: 24, color: 'var(--text)', cursor: 'pointer', padding: 4 }}
          >
            {isMenuOpen ? '✕' : '☰'}
          </button>
        )}

        {!isMobile && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {onLangChange && (
              <div style={{ display: 'flex', gap: 4 }}>
                {(['fr', 'en'] as const).map(l => (
                  <button key={l} onClick={() => onLangChange(l)} style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                    backgroundColor: lang === l ? 'var(--accent)' : 'transparent',
                    color: lang === l ? 'white' : 'var(--text-muted)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: '0.2s',
                  }}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {!ready ? (
              <div className="skeleton" style={{ width: 120, height: 20 }} />
            ) : user ? (
              <>
                <a href="/ranked" style={{ fontSize: 14, color: pathname === '/ranked' ? 'var(--accent)' : 'var(--text-muted)', textDecoration: 'none', fontWeight: pathname === '/ranked' ? 600 : 500 }}>
                  {t.ranked}
                </a>
                <a href="/history" style={{ fontSize: 14, color: pathname === '/history' ? 'var(--accent)' : 'var(--text-muted)', textDecoration: 'none', fontWeight: pathname === '/history' ? 600 : 500 }}>
                  {t.history}
                </a>
                <a href="/leaderboard" style={{ fontSize: 14, color: pathname === '/leaderboard' ? 'var(--accent)' : 'var(--text-muted)', textDecoration: 'none', fontWeight: pathname === '/leaderboard' ? 600 : 500 }}>
                  {t.leaderboard}
                </a>
                <a href="/profile" style={{ fontSize: 14, color: 'var(--text)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {username || user.email}
                  {streak > 0 && (
                    <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>
                      {streak} 🔥
                    </span>
                  )}
                </a>
                <button onClick={handleLogout} style={{
                  fontSize: 13, color: 'var(--text-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0,
                }}>
                  {t.logout}
                </button>
              </>
            ) : (
              <a href="/auth/login" style={{
                fontSize: 14, color: 'var(--text)', fontWeight: 600,
                padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', textDecoration: 'none',
              }}>
                {t.login}
              </a>
            )}

            <button onClick={toggle} style={{
              width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 15, cursor: 'pointer', transition: '0.2s',
            }}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </nav>
        )}
      </div>

      {isMobile && isMenuOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--border)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'flex', flexDirection: 'column', padding: '16px 20px', gap: 16,
        }}>
          {onLangChange && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {(['fr', 'en'] as const).map(l => (
                <button key={l} onClick={() => { onLangChange(l); setIsMenuOpen(false); }} style={{
                  padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)',
                  backgroundColor: lang === l ? 'var(--accent)' : 'transparent',
                  color: lang === l ? 'white' : 'var(--text-muted)',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', flex: 1,
                }}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          <div style={{ height: 1, backgroundColor: 'var(--border)', width: '100%' }} />

          {!ready ? (
            <div className="skeleton" style={{ width: '100%', height: 20 }} />
          ) : user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <a href="/profile" style={{ fontSize: 16, color: 'var(--text)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                {t.myProfile} ({username || user.email})
                {streak > 0 && (
                  <span style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 700 }}>
                    {streak} 🔥
                  </span>
                )}
              </a>
              <a href="/ranked" style={{ fontSize: 16, color: pathname === '/ranked' ? 'var(--accent)' : 'var(--text-muted)', textDecoration: 'none', fontWeight: pathname === '/ranked' ? 600 : 500 }}>
                {t.ranked}
              </a>
              <a href="/history" style={{ fontSize: 16, color: pathname === '/history' ? 'var(--accent)' : 'var(--text-muted)', textDecoration: 'none', fontWeight: pathname === '/history' ? 600 : 500 }}>
                {t.history}
              </a>
              <a href="/leaderboard" style={{ fontSize: 16, color: pathname === '/leaderboard' ? 'var(--accent)' : 'var(--text-muted)', textDecoration: 'none', fontWeight: pathname === '/leaderboard' ? 600 : 500 }}>
                {t.leaderboard}
              </a>
              <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} style={{
                fontSize: 15, color: 'var(--accent)', background: 'none', border: 'none',
                cursor: 'pointer', padding: '8px 0', fontWeight: 600, marginTop: 8,
              }}>
                {t.logout}
              </button>
            </div>
          ) : (
            <a href="/auth/login" style={{
              fontSize: 16, color: 'var(--bg)', backgroundColor: 'var(--text)',
              fontWeight: 600, padding: '10px 16px', borderRadius: 6,
              textDecoration: 'none', textAlign: 'center',
            }}>
              {t.loginMobile}
            </a>
          )}

          <div style={{ height: 1, backgroundColor: 'var(--border)', width: '100%' }} />

          <button onClick={toggle} style={{
            padding: '10px', borderRadius: 8, border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8, fontSize: 15, color: 'var(--text)',
            fontWeight: 500, cursor: 'pointer',
          }}>
            {theme === 'light' ? `🌙 ${t.darkMode}` : `☀️ ${t.lightMode}`}
          </button>
        </div>
      )}
    </header>
  )
}
