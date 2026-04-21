'use client'

import React from 'react'
import type { MobileTab } from '@/hooks/useMobileTab'

export interface BottomTabBarProps {
  activeTab: MobileTab
  onTabChange: (t: MobileTab) => void
  keyboardOpen: boolean
  lang: 'fr' | 'en'
}

const LABELS: Record<'fr' | 'en', Record<MobileTab, string>> = {
  fr: { jeu: 'Jeu', mots: 'Mots', stats: 'Stats' },
  en: { jeu: 'Game', mots: 'Words', stats: 'Stats' },
}

const TABS: MobileTab[] = ['jeu', 'mots', 'stats']

export default function BottomTabBar({ activeTab, onTabChange, keyboardOpen, lang }: BottomTabBarProps) {
  return (
    <nav
      role="tablist"
      aria-label="Game sections"
      style={{
        position: 'fixed',
        left: 0, right: 0, bottom: 0,
        height: 56,
        display: 'flex',
        background: 'var(--wf-surface)',
        borderTop: '1px solid var(--wf-border)',
        zIndex: 90,
        transform: keyboardOpen ? 'translateY(100%)' : 'translateY(0)',
        opacity: keyboardOpen ? 0 : 1,
        pointerEvents: keyboardOpen ? 'none' : 'auto',
        transition: 'transform 160ms ease-out, opacity 160ms ease-out',
        fontFamily: 'var(--wf-font-ui)',
      }}
    >
      {TABS.map(tab => {
        const isActive = tab === activeTab
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onTabChange(tab)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--wf-ink)' : 'var(--wf-muted)',
              borderTop: isActive ? '2px solid var(--wf-accent)' : '2px solid transparent',
              transition: 'color 160ms ease-out',
            }}
          >
            {LABELS[lang][tab]}
          </button>
        )
      })}
    </nav>
  )
}
