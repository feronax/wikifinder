'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
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
  children,
}: MobileShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const closeDrawer = () => setDrawerOpen(false)

  const links = NAV_LINKS[lang]

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
            aria-label="Open navigation"
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
              color: 'var(--wf-ink)',
            }}
          >
            Wikifinder
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
            }}
          >
            🔥 {streak}
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
              color: 'var(--wf-ink)',
            }}
          >
            Wikifinder
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
          <ActionRowButton
            label={lang === 'fr' ? 'Défier un ami' : 'Challenge a friend'}
            onClick={async () => { closeDrawer(); await onDuelCreate() }}
          />
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
