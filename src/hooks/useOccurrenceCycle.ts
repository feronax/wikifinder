'use client'

import { useCallback, useRef, useState } from 'react'

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
  const [highlighted, setHighlighted] = useState<{ word: string; idx: number } | null>(null)

  const cycle = useCallback((normalizedWord: string) => {
    const nodes = document.querySelectorAll(`[data-word="${normalizedWord}"]`)
    if (nodes.length === 0) return

    const prev = cursorsRef.current.get(normalizedWord) ?? -1
    const next = (prev + 1) % nodes.length
    cursorsRef.current.set(normalizedWord, next)

    // window.scrollTo with smooth — respects prefers-reduced-motion via the
    // behavior override. Using explicit targetY avoids the edge case where
    // scrollIntoView({smooth}) silently no-ops on inline elements with
    // scroll-margin-block-end active (observed Chromium behavior).
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rect = (nodes[next] as HTMLElement).getBoundingClientRect()
    const targetY = rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2
    window.scrollTo({ top: targetY, behavior: reduced ? 'auto' : 'smooth' })

    // Highlighted persists (sticky) — amber marks the LAST-CLICKED word in the
    // article body until the user clicks another chip. The pulse animation
    // itself is one-shot CSS (500ms), so no JS-side clearing needed.
    setHighlighted({ word: normalizedWord, idx: next })
  }, [])

  const resetOthers = useCallback((currentWord: string) => {
    for (const k of Array.from(cursorsRef.current.keys())) {
      if (k !== currentWord) cursorsRef.current.delete(k)
    }
  }, [])

  return { cycle, resetOthers, highlighted }
}
