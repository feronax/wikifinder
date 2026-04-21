'use client'

import React, { useEffect, useState } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const EASING = 'cubic-bezier(.2,.8,.2,1)'

export interface BurgerDrawerProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export default function BurgerDrawer({ open, onClose, children }: BurgerDrawerProps) {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(REDUCED_MOTION_QUERY)
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  const overlayDur = reduced ? 80 : 260
  const slideDur = reduced ? 0 : 260

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0,
          background: 'rgb(0 0 0 / 0.6)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: `opacity ${overlayDur}ms ${EASING}`,
          zIndex: 100,
        }}
      />
      <div
        role="dialog" aria-modal="true" aria-label="Navigation"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: 'min(280px, 82vw)',
          background: 'var(--wf-surface)',
          borderRight: '1px solid var(--wf-border-strong)',
          transform: `translateX(${open ? '0' : '-100%'})`,
          transition: `transform ${slideDur}ms ${EASING}`,
          zIndex: 101,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </>
  )
}
