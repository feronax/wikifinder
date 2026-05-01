'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { tokens as tokensData, type TokenSet, type Theme } from '@/lib/design/tokens'
import {
  loadLocalPrefs,
  saveLocalPrefs,
  usePreferenceSync,
  usePreferencesBootstrap,
} from '@/lib/preferences'

type ThemeContextValue = {
  theme: Theme
  mode: Theme
  tokens: TokenSet
  toggle: () => void
  setMode: (m: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  mode: 'light',
  tokens: tokensData.light,
  toggle: () => {},
  setMode: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

// Phase 13 / Plan 06 — POL-05 flag-flip: the prior `readFlagCookie()` helper
// (which read wf_new_design as a dark-default seed during the rollout) was
// removed as part of the legacy purge. D-14 investigation confirmed it read
// only the wf_new_design cookie; with the flag removed, the seed falls
// through cleanly to system preference. Saved user preference (wf_prefs.mode)
// still wins over both. The TH-02 anti-FOUC inline script in app/layout.tsx
// remains the source of truth for first-paint `data-theme`.

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Theme>('light')
  const userIdRef = useRef<string | null>(null)
  const queueSync = usePreferenceSync()

  useEffect(() => {
    // loadLocalPrefs() handles the one-shot legacy 'theme' → wf_prefs.mode migration
    // internally and deletes the legacy key.
    const local = loadLocalPrefs()
    const saved = local.mode
    const systemDark = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
    const initial: Theme =
      saved === 'light' || saved === 'dark'
        ? saved
        : systemDark
        ? 'dark'
        : 'light'
    setModeState(initial)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', initial)
    }
  }, [])

  usePreferencesBootstrap({
    userIdRef,
    queueSync,
    onHydrated: (remote) => {
      if (remote.mode === 'light' || remote.mode === 'dark') {
        setModeState(remote.mode)
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', remote.mode)
        }
      }
    },
  })

  function setMode(next: Theme) {
    setModeState(next)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next)
    }
    saveLocalPrefs({ mode: next })
    queueSync({ mode: next }, userIdRef.current)
  }

  function toggle() {
    setMode(mode === 'light' ? 'dark' : 'light')
  }

  const tokens = useMemo<TokenSet>(() => tokensData[mode], [mode])

  const value: ThemeContextValue = {
    theme: mode,
    mode,
    tokens,
    toggle,
    setMode,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
