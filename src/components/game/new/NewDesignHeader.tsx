'use client'

/**
 * NewDesignHeader — Phase 9 flag-on variant of the top nav.
 *
 * Identical structure + behavior to the legacy <Header> component, but
 * restyles the "Wikifinder" logo to match design-proto/Wikifinder.html:191-193:
 *   - fontFamily: var(--wf-font-head)  (Geist)
 *   - fontSize 22, fontWeight 600, letter-spacing -0.02em
 *   - "Wiki" in var(--wf-ink)
 *   - "finder" in var(--wf-accent)
 *
 * Legacy <Header> is left unmodified (D-02 byte-identical flag-off preserved).
 * When WF_NEW_DESIGN=1 on the daily game screen, game/page.tsx renders this
 * component instead of the legacy <Header>.
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X, Flame } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useIsMobile } from '@/lib/utils'
import ModeToggle from '@/components/design/ModeToggle'

type NewDesignHeaderProps = {
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
    friends: 'Amis',
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
    friends: 'Friends',
    login: 'Login',
    loginMobile: 'Login',
    logout: 'Logout',
    myProfile: 'My Profile',
    darkMode: 'Switch to dark mode',
    lightMode: 'Switch to light mode',
  },
}

export default function NewDesignHeader({ lang, onLangChange: _onLangChange, user: userProp, username: usernameProp, onLogout: onLogoutProp }: NewDesignHeaderProps) {
  const { theme: _theme, toggle: _toggle } = useTheme()
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

  // Logo split: "Wiki" in ink, "finder" in accent (design-proto Wikifinder.html:191-193).
  const logo = (
    <a
      href="/game"
      style={{
        fontFamily: 'var(--wf-font-head)',
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        textDecoration: 'none',
        lineHeight: 1,
      }}
    >
      <span style={{ color: 'var(--wf-ink)' }}>Wiki</span>
      <span style={{ color: 'var(--wf-accent)' }}>finder</span>
    </a>
  )

  return (
    <header style={{ position: 'relative', zIndex: 100 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '12px 20px' : '16px 32px',
        borderBottom: '1px solid var(--wf-border)',
        backgroundColor: 'var(--wf-bg)',
      }}>
        {logo}

        {isMobile && (
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{ background: 'none', border: 'none', fontSize: 24, color: 'var(--wf-ink)', cursor: 'pointer', padding: 4 }}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        )}

        {!isMobile && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {!ready ? (
              <div className="skeleton" style={{ width: 120, height: 20 }} />
            ) : user ? (
              <>
                <a href="/ranked" style={{ fontSize: 14, color: pathname === '/ranked' ? 'var(--wf-accent)' : 'var(--wf-muted)', textDecoration: 'none', fontWeight: pathname === '/ranked' ? 600 : 500 }}>
                  {t.ranked}
                </a>
                <a href="/history" style={{ fontSize: 14, color: pathname === '/history' ? 'var(--wf-accent)' : 'var(--wf-muted)', textDecoration: 'none', fontWeight: pathname === '/history' ? 600 : 500 }}>
                  {t.history}
                </a>
                <a href="/leaderboard" style={{ fontSize: 14, color: pathname === '/leaderboard' ? 'var(--wf-accent)' : 'var(--wf-muted)', textDecoration: 'none', fontWeight: pathname === '/leaderboard' ? 600 : 500 }}>
                  {t.leaderboard}
                </a>
                <a href="/friends" style={{ fontSize: 14, color: pathname === '/friends' ? 'var(--wf-accent)' : 'var(--wf-muted)', textDecoration: 'none', fontWeight: pathname === '/friends' ? 600 : 500 }}>
                  {t.friends}
                </a>
                <a href="/profile" style={{ fontSize: 14, color: 'var(--wf-ink)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {username || user.email}
                  {streak > 0 && (
                    <span style={{ fontSize: 13, color: 'var(--wf-accent)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Flame size={14} /> {streak}
                    </span>
                  )}
                </a>
                <button onClick={handleLogout} style={{
                  fontSize: 13, color: 'var(--wf-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0,
                }}>
                  {t.logout}
                </button>
              </>
            ) : (
              <a href="/auth/login" style={{
                fontSize: 14, color: 'var(--wf-ink)', fontWeight: 600,
                padding: '6px 16px', borderRadius: 'var(--wf-radius)', border: '1px solid var(--wf-border)', textDecoration: 'none',
              }}>
                {t.login}
              </a>
            )}

            <ModeToggle />
          </nav>
        )}
      </div>

      {isMobile && isMenuOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          backgroundColor: 'var(--wf-bg)', borderBottom: '1px solid var(--wf-border)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'flex', flexDirection: 'column', padding: '16px 20px', gap: 16,
        }}>
          {!ready ? (
            <div className="skeleton" style={{ width: '100%', height: 20 }} />
          ) : user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <a href="/profile" style={{ fontSize: 16, color: 'var(--wf-ink)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                {t.myProfile} ({username || user.email})
                {streak > 0 && (
                  <span style={{ fontSize: 14, color: 'var(--wf-accent)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Flame size={16} /> {streak}
                  </span>
                )}
              </a>
              <a href="/ranked" style={{ fontSize: 16, color: pathname === '/ranked' ? 'var(--wf-accent)' : 'var(--wf-muted)', textDecoration: 'none', fontWeight: pathname === '/ranked' ? 600 : 500 }}>
                {t.ranked}
              </a>
              <a href="/history" style={{ fontSize: 16, color: pathname === '/history' ? 'var(--wf-accent)' : 'var(--wf-muted)', textDecoration: 'none', fontWeight: pathname === '/history' ? 600 : 500 }}>
                {t.history}
              </a>
              <a href="/leaderboard" style={{ fontSize: 16, color: pathname === '/leaderboard' ? 'var(--wf-accent)' : 'var(--wf-muted)', textDecoration: 'none', fontWeight: pathname === '/leaderboard' ? 600 : 500 }}>
                {t.leaderboard}
              </a>
              <a href="/friends" style={{ fontSize: 16, color: pathname === '/friends' ? 'var(--wf-accent)' : 'var(--wf-muted)', textDecoration: 'none', fontWeight: pathname === '/friends' ? 600 : 500 }}>
                {t.friends}
              </a>
              <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} style={{
                fontSize: 15, color: 'var(--wf-accent)', background: 'none', border: 'none',
                cursor: 'pointer', padding: '8px 0', fontWeight: 600, marginTop: 8,
              }}>
                {t.logout}
              </button>
            </div>
          ) : (
            <a href="/auth/login" style={{
              fontSize: 16, color: 'var(--wf-bg)', backgroundColor: 'var(--wf-ink)',
              fontWeight: 600, padding: '10px 16px', borderRadius: 'var(--wf-radius)',
              textDecoration: 'none', textAlign: 'center',
            }}>
              {t.loginMobile}
            </a>
          )}

          <div style={{ height: 1, backgroundColor: 'var(--wf-border)', width: '100%' }} />

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ModeToggle size={44} />
          </div>
        </div>
      )}
    </header>
  )
}
