'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

/**
 * Reveal-animation orchestrator (GS-03). Drives the chain for a newly-revealed
 * word:
 *   flash 400ms → fade 600ms → smooth scroll to first occurrence → pulse 500ms
 *
 * State:
 *   - `justRevealed: string | null` — the normalized word currently in the
 *     flash/fade window. Consumers (Mask) read this to apply the animation.
 *     Cleared back to null at +1100ms (400 flash + 600 fade + 100ms slack).
 *
 * Scroll timing (fixed 2026-07-22):
 *   The token's `data-word="<word>"` only appears AFTER the server round-trip
 *   applies revealedTokens (page.tsx syncGuessWithServer) — before that the
 *   masked span carries data-word="". The old fixed +80ms scroll therefore
 *   raced the server: it silently no-op'd on slow networks and, when the server
 *   won the race, yanked the view to re-center a word that was often already
 *   on screen ("scrolls a tiny bit each guess"). We now:
 *     1. poll (via short setTimeouts) until the revealed node actually exists,
 *     2. scroll ONLY if that node is off the safe viewport (above the fixed
 *        input + soft keyboard) — an already-visible reveal never moves the page.
 *
 * DOM contract:
 *   - Targets `document.querySelector('[data-word="<word>"]')` (first in
 *     document order). Emitted by Mask per 09-PATTERNS.md.
 *
 * Safe-timer cleanup: all scheduled setTimeouts are tracked in a ref-held Set
 * and cleared on unmount, so late callbacks cannot dispatch on an unmounted
 * component (D-07).
 *
 * Reduced-motion (D-09, D-19): detected at call-time; reduced ⇒ behavior 'auto'.
 */

// Reserve for the fixed bottom input (~76px) + breathing room, plus the soft
// keyboard inset published by useKeyboardInset. A reveal whose box sits inside
// [8px, innerHeight − kbInset − reserve] is considered visible → no scroll.
const BOTTOM_RESERVE = 120

function isInSafeView(el: Element): boolean {
  const r = el.getBoundingClientRect()
  const kb =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--wf-kb-inset'),
    ) || 0
  const bottomLimit = window.innerHeight - kb - BOTTOM_RESERVE
  return r.top >= 8 && r.bottom <= bottomLimit
}

export function useRevealAnimation(): {
  justRevealed: string | null
  trigger: (normalizedWord: string) => void
} {
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const [justRevealed, setJustRevealed] = useState<string | null>(null)

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  const trigger = useCallback((normalizedWord: string) => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    setJustRevealed(normalizedWord)

    // Poll for the revealed node (it appears only once the server round-trip
    // unmasks it), then scroll if off-screen. ~8 tries × 80ms ≈ 640ms budget.
    let attempts = 0
    const schedule = (fn: () => void, ms: number) => {
      const t: ReturnType<typeof setTimeout> = setTimeout(() => {
        timersRef.current.delete(t)
        fn()
      }, ms)
      timersRef.current.add(t)
    }
    const tryScroll = () => {
      const el = document.querySelector(`[data-word="${normalizedWord}"]`)
      if (el) {
        if (!isInSafeView(el)) {
          el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
        }
        return
      }
      if (attempts++ < 8) schedule(tryScroll, 80)
    }
    schedule(tryScroll, 80)

    // Clear flash/fade state after the chain completes (400 + 600 + 100 slack).
    schedule(() => setJustRevealed(null), 1100)
  }, [])

  return { justRevealed, trigger }
}
