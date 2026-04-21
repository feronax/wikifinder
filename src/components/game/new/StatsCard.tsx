'use client'

import React from 'react'

interface StatsCardProps {
  elapsed: number
  attemptsCount: number
  foundCount: number
  totalRevealableTokens: number
  lang: 'fr' | 'en'
}

const COPY = {
  fr: {
    attempts: 'TENTATIVES',
    found: 'TROUVÉS',
    time: 'TEMPS',
    articleRevealed: 'ARTICLE RÉVÉLÉ',
  },
  en: {
    attempts: 'ATTEMPTS',
    found: 'FOUND',
    time: 'TIME',
    articleRevealed: 'ARTICLE REVEALED',
  },
} as const

export default function StatsCard({
  elapsed,
  attemptsCount,
  foundCount,
  totalRevealableTokens,
  lang,
}: StatsCardProps) {
  const mm = Math.floor(elapsed / 60)
  const ss = elapsed % 60
  const chrono = mm + ':' + String(ss).padStart(2, '0')
  const pct =
    totalRevealableTokens > 0
      ? Math.round((foundCount / totalRevealableTokens) * 100)
      : 0
  const t = COPY[lang]

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: 1,
    color: 'var(--wf-muted)',
    textTransform: 'uppercase',
  }

  const numberStyle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--wf-ink)',
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'var(--wf-font-head)',
    lineHeight: 1,
    marginTop: 4,
  }

  // Proto game.jsx:380-384 — 3-inline stats row (Tentatives / Trouvés / Temps);
  // % lives on the progress-bar row, not as a separate cell.
  return (
    <section
      style={{
        background: 'var(--wf-surface)',
        border: '1px solid var(--wf-border)',
        borderRadius: 'var(--wf-radius-card)',
        padding: 16,
        fontFamily: 'var(--wf-font-ui)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div style={labelStyle}>{t.attempts}</div>
          <div style={numberStyle}>{attemptsCount}</div>
        </div>
        <div>
          <div style={labelStyle}>{t.found}</div>
          <div style={numberStyle}>{foundCount}</div>
        </div>
        <div>
          <div style={labelStyle}>{t.time}</div>
          <div
            style={{
              ...numberStyle,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            }}
          >
            {chrono}
          </div>
        </div>
      </div>

      {/* Progress bar row — label on left, percent on right (amber), bar below */}
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 6,
          }}
        >
          <span style={labelStyle}>{t.articleRevealed}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--wf-accent)',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'var(--wf-font-ui)',
            }}
          >
            {pct}%
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: 'var(--wf-bg2)',
            border: '1px solid var(--wf-border)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: pct + '%',
              height: '100%',
              background: 'var(--wf-accent)',
              transition: 'width 400ms cubic-bezier(.22, 1, .36, 1)',
            }}
          />
        </div>
      </div>
    </section>
  )
}
