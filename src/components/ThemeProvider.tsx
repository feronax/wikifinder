'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { tokens as tokensData, type TokenSet, type Theme } from '@/lib/design/tokens'

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

function readFlagCookie(): boolean {
  if (typeof document === 'undefined') return false
  const match = document.cookie.match(/(?:^|; )wf_new_design=([01])/)
  return match?.[1] === '1'
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Theme>('light')

  useEffect(() => {
    const saved = (typeof localStorage !== 'undefined'
      ? (localStorage.getItem('theme') as Theme | null)
      : null)
    const flagDark = readFlagCookie()
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initial: Theme =
      saved === 'light' || saved === 'dark'
        ? saved
        : flagDark
        ? 'dark'
        : systemDark
        ? 'dark'
        : 'light'
    setModeState(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  function setMode(next: Theme) {
    setModeState(next)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next)
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', next)
    }
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
