'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Flame } from 'lucide-react'
import BurgerDrawer from '@/components/game/new/mobile/BurgerDrawer'
import BottomTabBar from '@/components/game/new/mobile/BottomTabBar'
import ActionRowButton from '@/components/game/new/ActionRowButton'
import type { MobileTab } from '@/hooks/useMobileTab'

/**
 * MobileShell — mobile chrome around a body slot.
 *
 * Composition:
 *   - Sticky top bar: burger (top-left, Lucide Menu) + Wikifinder wordmark (center) + lang-pill (top-right)
 *   - <main> body slot (tab panels rendered by NewGameScreenMobile — Plan 05)
 *   - BottomTabBar (Plan 03) fixed at viewport bottom
 *   - BurgerDrawer (Plan 03) containing 7 nav links per D-12 + FR/EN pill
 *
 * Locked per CONTEXT D-12/D-13/D-15/D-16:
 *   - Burger top-LEFT, lang-pill top-right (D-16)
 *   - 7 nav links: Accueil/Jeu/Classé/Historique/Classement/Profil/Amis (D-12)
 *   - D-13 deferrals: no mode switcher (Phase 11), no session sign-out (Phase 11), no issue-report link (Phase 12)
 *   - Drawer auto-closes on nav-link tap (D-15)
 *
 * z-index map: header 80 — BottomTabBar 90 — FixedBottomInput 95 — drawer overlay 100 — drawer panel 101.
 */

const NAV_LINKS = {
  fr: [
    { href: '/', label: 'Accueil' },
    { href: '/game', label: 'Jeu' },
    { href: '/ranked', label: 'Classé' },
    { href: '/history', label: 'Historique' },
    { href: '/leaderboard', label: 'Classement' },
    { href: '/profile', label: 'Profil' },
    { href: '/friends', label: 'Amis' },
  ],
  en: [
    { href: '/', label: 'Home' },
    { href: '/game', label: 'Game' },
    { href: '/ranked', label: 'Ranked' },
    { href: '/history', label: 'History' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/profile', label: 'Profile' },
    { href: '/friends', label: 'Friends' },
  ],
} as const

export interface MobileShellProps {
  activeTab: MobileTab
  onTabChange: (t: MobileTab) => void
  keyboardOpen: boolean
  lang: 'fr' | 'en'
  onLangChange: (next: 'fr' | 'en') => void
  streak?: number
  // Phase 10.3-08 — mobile Actions section reduced to single Défier button
  // (Indice + Abandonner removed per UAT scope change, Gaps B + C).
  onDuelCreate: () => Promise<void>
  // Phase 12 / Plan 05 — burger entry points for OnboardingModal +
  // FeedbackModal (D-15 D-03). Required props on this shell.
  onOpenOnboarding: () => void
  onOpenFeedback: () => void
  // Phase 13 / Plan 04 (D-12, MOD-03) — defeat "Voir la solution" CTA.
  // Rendered inside the burger drawer Actions section (mobile parity with
  // desktop ActionRow defeat CTA). Undefined → button hidden.
  onRevealSolution?: () => void
  // When false/undefined, the burger nav is restricted to public pages
  // (Home + Game) plus a Login link. Authed users get the full 7-link nav.
  isAuthed?: boolean
  children: React.ReactNode
}

export default function MobileShell({
  activeTab,
  onTabChange,
  keyboardOpen,
  lang,
  onLangChange,
  streak = 0,
  onDuelCreate,
  onOpenOnboarding,
  onOpenFeedback,
  onRevealSolution,
  isAuthed,
  children,
}: MobileShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const closeDrawer = () => setDrawerOpen(false)

  // Anon users only get public pages: Home + Game. Login link is appended
  // separately below the nav. Authed users get the full 7-link set.
  const PUBLIC_HREFS = new Set(['/', '/game'])
  const links = isAuthed
    ? NAV_LINKS[lang]
    : NAV_LINKS[lang].filter(l => PUBLIC_HREFS.has(l.href))
  const loginLabel = lang === 'fr' ? 'Se connecter' : 'Log in'

  const renderLangPill = (size: 'sm' | 'md') => {
    const pad = size === 'md' ? '6px 16px' : '4px 12px'
    const fs = size === 'md' ? 14 : 13
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 999,
          border: '1px solid var(--wf-border)',
          overflow: 'hidden',
          background: 'var(--wf-bg2)',
        }}
      >
        {(['fr', 'en'] as const).map((l) => {
          const isActive = l === lang
          return (
            <button
              key={l}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onLangChange(l)}
              aria-pressed={isActive}
              style={{
                padding: pad,
                fontSize: fs,
                fontFamily: 'inherit',
                fontWeight: isActive ? 600 : 500,
                background: isActive ? 'var(--wf-accent)' : 'transparent',
                color: isActive ? 'var(--wf-accent-ink)' : 'var(--wf-muted)',
                border: 'none',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {l}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--wf-bg)',
        fontFamily: 'var(--wf-font-ui)',
        color: 'var(--wf-ink)',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 80,
          padding: '12px 16px',
          borderBottom: '1px solid var(--wf-border)',
          background: 'var(--wf-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* LEFT GROUP: burger + Wikifinder wordmark (D-05 restyle) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: 'var(--wf-ink)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Menu size={24} aria-hidden="true" />
          </button>

          <span
            style={{
              fontFamily: 'var(--wf-font-head)',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            <span style={{ color: 'var(--wf-ink)' }}>Wiki</span>
            <span style={{ color: 'var(--wf-accent-text-on-light)' }}>finder</span>
          </span>
        </div>

        {/* RIGHT SLOT: conditional streak pill (D-02, D-04).
            Empty when streak === 0 or unauthed — justify-content:space-between
            handles the 2-child collapse naturally. Emoji-first order is
            intentional (D-02a; opposite of desktop Header.tsx). */}
        {streak > 0 ? (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: 999,
              border: '1px solid var(--wf-border)',
              background: 'var(--wf-bg2)',
              fontSize: 12,
              color: 'var(--wf-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Flame size={14} /> {streak}
          </span>
        ) : null}
      </header>

      <main
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
        }}
      >
        {children}
      </main>

      <BottomTabBar
        activeTab={activeTab}
        onTabChange={onTabChange}
        keyboardOpen={keyboardOpen}
        lang={lang}
      />

      <BurgerDrawer open={drawerOpen} onClose={closeDrawer}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--wf-border)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--wf-font-head)',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            <span style={{ color: 'var(--wf-ink)' }}>Wiki</span>
            <span style={{ color: 'var(--wf-accent-text-on-light)' }}>finder</span>
          </span>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close navigation"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: 'var(--wf-ink)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        <nav
          aria-label="Primary"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 8,
          }}
        >
          {links.map(({ href, label }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={closeDrawer}
                style={{
                  padding: '14px 20px',
                  fontSize: 16,
                  textDecoration: 'none',
                  color: isActive ? 'var(--wf-accent)' : 'var(--wf-ink)',
                  fontWeight: isActive ? 600 : 500,
                  borderLeft: isActive
                    ? '3px solid var(--wf-accent)'
                    : '3px solid transparent',
                  fontFamily: 'inherit',
                }}
              >
                {label}
              </Link>
            )
          })}
          {!isAuthed && (
            <Link
              href="/auth/login"
              onClick={closeDrawer}
              style={{
                padding: '14px 20px',
                fontSize: 16,
                textDecoration: 'none',
                color: pathname === '/auth/login' ? 'var(--wf-accent)' : 'var(--wf-ink)',
                fontWeight: pathname === '/auth/login' ? 600 : 500,
                borderLeft:
                  pathname === '/auth/login'
                    ? '3px solid var(--wf-accent)'
                    : '3px solid transparent',
                fontFamily: 'inherit',
              }}
            >
              {loginLabel}
            </Link>
          )}
        </nav>

        {/* Phase 10.3-08 — mobile Actions section reduced to single Défier
            button (Indice + Abandonner removed per UAT scope change, Gaps
            B + C). closeDrawer() before invoking the action preserves the
            D-15 auto-close pattern. */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--wf-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Phase 12 / Plan 05 — burger entry points (D-15, D-03).
              Pattern S6: closeDrawer() BEFORE onOpenX() synchronously so
              the drawer focus-trap releases before the modal opens
              (Pitfall 6 mitigation). Raw <button> instead of
              ActionRowButton so we can attach data-testid for the
              Plan-01 specs. */}
          <button
            type="button"
            data-testid="burger-howtoplay"
            onClick={() => { closeDrawer(); onOpenOnboarding() }}
            aria-label={lang === 'fr' ? 'Comment jouer' : 'How to play'}
            style={{
              padding: '12px 24px',
              minHeight: 44,
              borderRadius: 8,
              border: '1px solid var(--wf-border)',
              backgroundColor: 'transparent',
              color: 'var(--wf-ink)',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--wf-font-ui)',
              textAlign: 'left',
              width: '100%',
            }}
          >
            {lang === 'fr' ? 'Comment jouer' : 'How to play'}
          </button>
          <button
            type="button"
            data-testid="burger-feedback"
            onClick={() => { closeDrawer(); onOpenFeedback() }}
            aria-label={lang === 'fr' ? 'Signaler un problème' : 'Send feedback'}
            style={{
              padding: '12px 24px',
              minHeight: 44,
              borderRadius: 8,
              border: '1px solid var(--wf-border)',
              backgroundColor: 'transparent',
              color: 'var(--wf-ink)',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--wf-font-ui)',
              textAlign: 'left',
              width: '100%',
            }}
          >
            {lang === 'fr' ? 'Signaler un problème' : 'Send feedback'}
          </button>
          <ActionRowButton
            label={lang === 'fr' ? 'Défier un ami' : 'Challenge a friend'}
            onClick={async () => { closeDrawer(); await onDuelCreate() }}
          />
          {/* Phase 13 / Plan 04 (D-12, MOD-03) — defeat "Voir la solution"
              CTA, mobile parity with desktop ActionRow. closeDrawer() before
              invoking preserves the D-15 auto-close pattern. */}
          {onRevealSolution && (
            <ActionRowButton
              label={lang === 'fr' ? 'Voir la solution' : 'See the answer'}
              variant="destructive"
              onClick={() => { closeDrawer(); onRevealSolution() }}
            />
          )}
        </div>

        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--wf-border)',
            display: 'flex',
            justifyContent: 'flex-start',
          }}
        >
          {renderLangPill('md')}
        </div>
      </BurgerDrawer>
    </div>
  )
}
