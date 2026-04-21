'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks the on-screen-keyboard inset (px) and exposes it as a CSS variable
 * `--wf-kb-inset` on <html>. Components position themselves with
 * `bottom: var(--wf-kb-inset, 0)`.
 *
 * Formula (per D-08 canonical pattern):
 *   inset = window.innerHeight - (visualViewport.height + visualViewport.offsetTop)
 *
 * iOS Safari: layout viewport stays — visualViewport shrinks → inset > 0.
 * Android Chrome: layout viewport shrinks → inset clamps to 0 (Android already moved layout for us).
 *
 * Falls back via CSS @supports env(keyboard-inset-height) in globals.css when
 * visualViewport is unavailable (very old Android WebView). The hook returns
 * { inset: 0, isOpen: false } in that case so consumers degrade gracefully.
 *
 * Mount ONCE at the NewGameScreenMobile root (per Pitfall 7 — multiple instances
 * would race each other writing to the same CSS variable).
 */
export function useKeyboardInset(): { inset: number; isOpen: boolean } {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return // Old Android WebView — CSS @supports fallback applies

    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const next = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))
        document.documentElement.style.setProperty('--wf-kb-inset', `${next}px`)
        setInset(next)
      })
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)

    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      document.documentElement.style.removeProperty('--wf-kb-inset')
    }
  }, [])

  return { inset, isOpen: inset > 0 }
}
