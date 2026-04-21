'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

/**
 * Reveal-animation orchestrator (GS-03). Drives the four-stage chain for a
 * newly-revealed word:
 *   flash 400ms → fade 600ms → smooth scroll to first occurrence (+80ms)
 *                                                             → pulse 500ms
 *
 * State:
 *   - `justRevealed: string | null` — the normalized word currently in the
 *     flash/fade window. Consumers (Mask) read this to apply the animation.
 *     Cleared back to null at +1100ms (400 flash + 600 fade + 100ms slack).
 *
 * DOM contract:
 *   - Targets `document.querySelector('[data-word="<word>"]')` (first in
 *     document order) for smooth scroll. Emitted by Mask per 09-PATTERNS.md.
 *
 * Safe-timer cleanup: matches `src/lib/use-safe-timeout.ts` — all scheduled
 * setTimeouts are tracked in a ref-held Set and cleared on unmount, so late
 * callbacks cannot dispatch state updates on an unmounted component (D-07).
 *
 * Reduced-motion (D-09, D-19): `prefers-reduced-motion` is detected at
 * call-time (not mount-time) so system toggles take effect immediately. When
 * reduced, scroll uses `behavior: 'auto'` (jump, not smooth). The flash/fade
 * chain itself still sets `justRevealed` — the visual degradation is owned
 * by Mask's CSS.
 */
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

    // Scroll to the first occurrence once the flash has begun (+80ms).
    const scrollT: ReturnType<typeof setTimeout> = setTimeout(() => {
      timersRef.current.delete(scrollT)
      const el = document.querySelector(`[data-word="${normalizedWord}"]`)
      el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    }, 80)
    timersRef.current.add(scrollT)

    // Clear flash/fade state after the chain completes (400 + 600 + 100 slack).
    const clearT: ReturnType<typeof setTimeout> = setTimeout(() => {
      timersRef.current.delete(clearT)
      setJustRevealed(null)
    }, 1100)
    timersRef.current.add(clearT)
  }, [])

  return { justRevealed, trigger }
}
