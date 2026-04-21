'use client'

import React from 'react'
import type { TitleWord } from '@/app/game/types'

interface StatsCardProps {
  elapsed: number
  attemptsCount: number
  foundCount: number
  totalRevealableTokens: number
  titleWords?: TitleWord[]
  lang: 'fr' | 'en'
}

const COPY = {
  fr: {
    attempts: 'TENTATIVES',
    found: 'TROUVÉS',
    time: 'TEMPS',
    pct: '% RÉVÉLÉ',
    articleRevealed: 'ARTICLE RÉVÉLÉ',
    title: 'TITRE',
  },
  en: {
    attempts: 'ATTEMPTS',
    found: 'FOUND',
    time: 'TIME',
    pct: '% REVEALED',
    articleRevealed: 'ARTICLE REVEALED',
    title: 'TITLE',
  },
} as const

export default function StatsCard({
  elapsed,
  attemptsCount,
  foundCount,
  totalRevealableTokens,
  titleWords,
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

  // Title-progress segments: one per non-stopword title word (Bug 3).
  const titleSegments = (titleWords ?? []).filter((tw) => !tw.isStopword)
  const titleFound = titleSegments.filter((tw) => tw.revealed).length
  const titleTotal = titleSegments.length

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

      {titleTotal > 0 && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span style={labelStyle}>{t.title}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1,
                color: 'var(--wf-muted)',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'var(--wf-font-ui)',
              }}
            >
              {titleFound}/{titleTotal}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 3,
              marginTop: 6,
              height: 6,
            }}
          >
            {titleSegments.map((tw) => (
              <div
                key={tw.index}
                data-testid="title-segment"
                data-revealed={tw.revealed ? 'true' : 'false'}
                style={{
                  flex: 1,
                  height: '100%',
                  background: tw.revealed ? 'var(--wf-accent)' : 'var(--wf-bg2)',
                  borderRadius: 2,
                  transition: 'background 400ms cubic-bezier(.22, 1, .36, 1)',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
