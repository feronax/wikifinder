'use client'

import React, { useState } from 'react'

interface ChallengeButtonProps {
  lang: 'fr' | 'en'
  onCreate: () => Promise<void>
  disabled?: boolean
}

export default function ChallengeButton({ lang, onCreate, disabled }: ChallengeButtonProps) {
  const [busy, setBusy] = useState(false)
  const label = lang === 'fr' ? 'Défier un ami' : 'Challenge a friend'
  const aria = lang === 'fr'
    ? 'Défier un ami sur cet article'
    : 'Challenge a friend to this article'

  async function handle() {
    if (busy || disabled) return
    setBusy(true)
    try { await onCreate() } finally { setBusy(false) }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy || disabled}
      aria-busy={busy}
      aria-label={aria}
      style={{
        padding: '12px 24px',
        minHeight: 44,
        borderRadius: 8,
        border: '1px solid var(--accent)',
        backgroundColor: 'transparent',
        color: 'var(--accent)',
        fontSize: 15,
        fontWeight: 600,
        cursor: busy || disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-sans)',
        opacity: busy || disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  )
}
