'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Click-to-cycle through occurrences of a single tried-word (GS-07, D-15).
 *
 * Interaction contract (per D-15):
 *   - 1st cycle(word) → scroll + highlight the 1st [data-word=<word>] node.
 *   - Nth cycle(word) → the Nth occurrence in document order.
 *   - (N+1)th wraps back to 0.
 *   - Per-word cursor persists across calls to that same word.
 *   - resetOthers(currentWord) — called by the caller when a DIFFERENT word
 *     is clicked — drops every OTHER word's cursor, so returning to the
 *     previous word restarts at idx=0.
 *
 * State:
 *   - `highlighted: { word, idx } | null` — the occurrence currently pulsing.
 *     Consumers (Mask) read this to apply the 500ms pulse animation. Auto-
 *     clears to null at +500ms (pulse duration per UI-SPEC Animation Contract).
 *
 * Focus preservation (D-16): this hook does NOT manipulate focus. Callers
 * (TriedWordRow) must call `e.preventDefault()` on mouseDown to keep input
 * focus — that responsibility lives in plan 09-05, not here.
 *
 * Reduced-motion (D-19): prefers-reduced-motion detected at call-time; scroll
 * drops to `behavior: 'auto'`. Scale animation itself is owned by Mask's CSS.
 *
 * Timer safety: the 500ms pulse-clear timer is tracked in a ref and cleared
 * on unmount. Consecutive cycles clear the previous timer before scheduling
 * a new one so the highlight stays on the NEW target for a full 500ms window
 * rather than getting cleared mid-pulse by a stale timer.
 */
export function useOccurrenceCycle(): {
  cycle: (normalizedWord: string) => void
  resetOthers: (currentWord: string) => void
  highlighted: { word: string; idx: number } | null
} {
  const cursorsRef = useRef<Map<string, number>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [highlighted, setHighlighted] = useState<{ word: string; idx: number } | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const cycle = useCallback((normalizedWord: string) => {
    const nodes = document.querySelectorAll(`[data-word="${normalizedWord}"]`)
    if (nodes.length === 0) return

    const prev = cursorsRef.current.get(normalizedWord) ?? -1
    const next = (prev + 1) % nodes.length
    cursorsRef.current.set(normalizedWord, next)

    // Use 'auto' (instant) — 'smooth' silently fails on inline elements in
    // some Chromium contexts with the Phase-10 scroll-margin CSS in play.
    // Functional > aesthetic: user needs the scroll to actually happen.
    const rect = (nodes[next] as HTMLElement).getBoundingClientRect()
    const targetY = rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2
    window.scrollTo({ top: targetY, behavior: 'auto' })

    setHighlighted({ word: normalizedWord, idx: next })

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setHighlighted(null)
    }, 500)
  }, [])

  const resetOthers = useCallback((currentWord: string) => {
    for (const k of Array.from(cursorsRef.current.keys())) {
      if (k !== currentWord) cursorsRef.current.delete(k)
    }
  }, [])

  return { cycle, resetOthers, highlighted }
}
