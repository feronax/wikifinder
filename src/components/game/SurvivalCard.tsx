'use client'

import React from 'react'

interface SurvivalCardProps {
  resumeState: { chainLength: number; livesRemaining: number; language: 'fr' | 'en' } | null
  isAuthed: boolean
  defaultLang: 'fr' | 'en'
  onStart: (lang: 'fr' | 'en') => void
  onResume: () => void
  onSignIn: () => void
  t: {
    eyebrow: string
    heading: string
    subtitle: string
    langLabel: string
    startCta: string
    resumeHeading: string
    resumeMeta: (chain: number, lives: number) => string
    resumeCta: (chain: number, lives: number) => string
    signInCta: string
    livesAria: (n: number, total: number) => string
  }
}

export default function SurvivalCard({
  resumeState,
  isAuthed,
  defaultLang,
  onStart,
  onResume,
  onSignIn,
  t,
}: SurvivalCardProps) {
  const [pickedLang, setPickedLang] = React.useState<'fr' | 'en'>(defaultLang)
  const isResume = Boolean(resumeState)
  const lives = resumeState ? resumeState.livesRemaining : 3

  const baseStyle: React.CSSProperties = {
    padding: 24,
    borderRadius: 12,
    border: '1px solid var(--border)',
    backgroundColor: isResume ? 'var(--bg-secondary)' : 'var(--surface)',
    borderLeft: isResume ? '3px solid var(--accent)' : '1px solid var(--border)',
    marginBottom: 16,
  }

  const eyebrowStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--accent)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  }

  const headingStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--text)',
    margin: '8px 0 8px',
    lineHeight: 1.2,
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 400,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    marginBottom: 16,
  }

  const ctaStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 20px',
    minHeight: 44,
    borderRadius: 8,
    border: 'none',
    backgroundColor: 'var(--accent)',
    color: 'white',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  }

  const radioStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    minHeight: 36,
    borderRadius: 8,
    border: '1px solid var(--border)',
    backgroundColor: active ? 'var(--accent)' : 'transparent',
    color: active ? 'white' : 'var(--text-muted)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  })

  // Render lives preview row (3 slots: ❤️ filled, 🩶 lost)
  const slots: string[] = []
  for (let i = 0; i < 3; i++) slots.push(i < lives ? '\u2764\uFE0F' : '\uD83E\uDE76')

  function handlePrimary() {
    if (!isAuthed) {
      onSignIn()
      return
    }
    if (isResume) {
      onResume()
    } else {
      onStart(pickedLang)
    }
  }

  const primaryLabel = !isAuthed
    ? t.signInCta
    : isResume && resumeState
      ? t.resumeCta(resumeState.chainLength, resumeState.livesRemaining)
      : t.startCta

  return (
    <section
      aria-labelledby="survival-heading"
      style={baseStyle}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={eyebrowStyle}>{t.eyebrow}</div>
        <div
          role="status"
          aria-label={t.livesAria(lives, 3)}
          style={{ display: 'flex', gap: 4, fontSize: 14, lineHeight: 1 }}
        >
          {slots.map((s, i) => (
            <span key={i} aria-hidden="true">
              {s}
            </span>
          ))}
        </div>
      </div>
      <h2 id="survival-heading" style={headingStyle}>
        {isResume ? t.resumeHeading : t.heading}
      </h2>
      {isResume && resumeState ? (
        <div style={subtitleStyle}>
          {t.resumeMeta(resumeState.chainLength, resumeState.livesRemaining)}
        </div>
      ) : (
        <div style={subtitleStyle}>{t.subtitle}</div>
      )}
      {!isResume && isAuthed && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-muted)',
              marginBottom: 6,
            }}
          >
            {t.langLabel}
          </div>
          <div
            role="radiogroup"
            aria-label={t.langLabel}
            style={{ display: 'inline-flex', gap: 4 }}
          >
            {(['fr', 'en'] as const).map(l => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={pickedLang === l}
                onClick={() => setPickedLang(l)}
                style={radioStyle(pickedLang === l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" onClick={handlePrimary} style={ctaStyle}>
        {primaryLabel}
      </button>
    </section>
  )
}
