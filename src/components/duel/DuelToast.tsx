'use client'

import React, { useEffect } from 'react'

interface DuelToastProps {
  variant: 'success' | 'error'
  message: string
  onDismiss: () => void
  durationMs?: number
}

export default function DuelToast({ variant, message, onDismiss, durationMs = 3000 }: DuelToastProps) {
  useEffect(() => {
    const id = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(id)
  }, [onDismiss, durationMs])

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 20px',
        fontSize: 14,
        fontWeight: 500,
        color: variant === 'error' ? 'var(--destructive)' : 'var(--text)',
        boxShadow: 'var(--shadow)',
        fontFamily: 'var(--font-sans)',
        zIndex: 1000,
      }}
    >
      {message}
    </div>
  )
}
