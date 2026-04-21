'use client'

import { useCallback, useEffect, useState } from 'react'

export type MobileTab = 'jeu' | 'mots' | 'stats'

const STORAGE_PREFIX = 'wf_mobile_tab_'
const DEFAULT_TAB: MobileTab = 'jeu'

function isValidTab(v: unknown): v is MobileTab {
  return v === 'jeu' || v === 'mots' || v === 'stats'
}

/**
 * Persists the active mobile tab to sessionStorage keyed by pageId (D-04).
 *
 * SSR-safe: returns DEFAULT_TAB ('jeu') on the server and on the first client
 * render; hydrates from sessionStorage in useEffect after mount.
 *
 * Private-mode safe: setItem is wrapped in try/catch — Pitfall 6 (iOS private
 * browsing throws QuotaExceededError). UX degrades to "always start on Jeu",
 * which is acceptable.
 *
 * pageId null/undefined: state still works in-memory; persistence skipped.
 */
export function useMobileTab(pageId: string | null | undefined): {
  activeTab: MobileTab
  setActiveTab: (t: MobileTab) => void
} {
  const [activeTab, setActiveTabState] = useState<MobileTab>(DEFAULT_TAB)

  useEffect(() => {
    if (typeof window === 'undefined' || !pageId) return
    try {
      const stored = window.sessionStorage.getItem(STORAGE_PREFIX + pageId)
      if (isValidTab(stored)) {
        setActiveTabState(stored)
      }
    } catch {
      /* private mode getItem throw — silent */
    }
  }, [pageId])

  const setActiveTab = useCallback(
    (t: MobileTab) => {
      setActiveTabState(t)
      if (typeof window === 'undefined' || !pageId) return
      try {
        window.sessionStorage.setItem(STORAGE_PREFIX + pageId, t)
      } catch {
        /* QuotaExceededError / private mode — silent */
      }
    },
    [pageId],
  )

  return { activeTab, setActiveTab }
}
