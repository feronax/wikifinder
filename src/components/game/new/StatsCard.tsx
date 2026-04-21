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
    pct: '% RÉVÉLÉ',
    articleRevealed: 'ARTICLE RÉVÉLÉ',
  },
  en: {
    attempts: 'ATTEMPTS',
    found: 'FOUND',
    time: 'TIME',
    pct: '% REVEALED',
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
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
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
              fontFamily:
                'ui-monospace, SFMono-Regular, monospace',
            }}
          >
            {chrono}
          </div>
        </div>
        <div>
          <div style={labelStyle}>{t.pct}</div>
          <div
            style={{ ...numberStyle, color: 'var(--wf-accent)' }}
          >
            {pct}%
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={labelStyle}>{t.articleRevealed}</div>
        <div
          style={{
            height: 6,
            background: 'var(--wf-bg2)',
            borderRadius: 3,
            overflow: 'hidden',
            marginTop: 6,
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
