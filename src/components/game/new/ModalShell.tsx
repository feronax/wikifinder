'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

// Phase 10.3 P2 — reusable dialog primitive for the new-design tree.
// Minimal shell per CONTEXT D-02: backdrop + Esc + focus trap + body-scroll
// lock + close-X + ARIA. Phase 12 will extend with motion / layered chrome —
// this file intentionally ships without animations so the end-of-game loop
// can close in 10.3 with correct semantics and zero regressions.
//
// Tokens: var(--wf-*) only. Zero legacy tokens. Zero globals.css edits.
// z-index 200 — above BurgerDrawer (101) and BottomTabBar (~90) per
// RESEARCH.md A3.

export interface ModalShellProps {
  open: boolean
  onClose: () => void
  ariaLabelledBy: string
  children: React.ReactNode
}

export default function ModalShell({
  open,
  onClose,
  ariaLabelledBy,
  children,
}: ModalShellProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Body-scroll lock while open — pattern from BurgerDrawer.tsx:26-36
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Focus-on-open + Esc close + Tab focus trap — shape from
  // GiveUpConfirmDialog.tsx:30-59, adapted to cycle across all focusables
  // rather than just Cancel/Confirm.
  useEffect(() => {
    if (!open) return
    closeBtnRef.current?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab' && cardRef.current) {
        const focusables = cardRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        // rgba fallback for older browsers — D-02 locked pair
        background: 'rgba(0, 0, 0, 0.5)',
        // Theme-aware 80% backdrop tint over the app bg — D-02 locked
        backgroundColor: 'color-mix(in srgb, var(--wf-bg) 80%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        style={{
          position: 'relative',
          backgroundColor: 'var(--wf-surface)',
          borderRadius: 'var(--wf-radius-card)',
          border: '1px solid var(--wf-border)',
          padding: 24,
          maxWidth: 480,
          width: '100%',
          fontFamily: 'var(--wf-font-ui)',
          color: 'var(--wf-ink)',
        }}
      >
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: 'var(--wf-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  )
}
