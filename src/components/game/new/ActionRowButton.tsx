'use client'

import { useState } from 'react'

export interface ActionRowButtonProps {
  label: string
  onClick: () => void | Promise<void>
  variant?: 'neutral' | 'destructive'
  disabled?: boolean
  busy?: boolean
  subtext?: string
  ariaLabel?: string
}

export default function ActionRowButton({
  label,
  onClick,
  variant = 'neutral',
  disabled = false,
  busy,
  subtext,
  ariaLabel,
}: ActionRowButtonProps) {
  const [internalBusy, setInternalBusy] = useState(false)
  const effectiveBusy = busy ?? internalBusy

  async function handle() {
    if (effectiveBusy || disabled) return
    try {
      if (busy === undefined) setInternalBusy(true)
      await onClick()
    } finally {
      if (busy === undefined) setInternalBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={effectiveBusy || disabled}
      aria-busy={effectiveBusy}
      aria-label={ariaLabel ?? label}
      style={{
        padding: '12px 24px',
        minHeight: 44,
        borderRadius: 8,
        border:
          variant === 'destructive'
            ? '1px solid var(--wf-danger)'
            : '1px solid var(--wf-border)',
        backgroundColor: 'transparent',
        color: variant === 'destructive' ? 'var(--wf-danger)' : 'var(--wf-ink)',
        fontSize: 15,
        fontWeight: 600,
        cursor: effectiveBusy || disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--wf-font-ui)',
        opacity: effectiveBusy || disabled ? 0.6 : 1,
        textAlign: 'left',
        width: '100%',
      }}
    >
      <div>{label}</div>
      {subtext && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--wf-muted)',
            marginTop: 2,
          }}
        >
          {subtext}
        </div>
      )}
    </button>
  )
}
