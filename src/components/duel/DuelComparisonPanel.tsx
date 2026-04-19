'use client'

import React from 'react'

type HalfSummary = {
  username: string
  guessCount: number | null
  durationSec: number | null
  won: boolean
  dnf: boolean
}

interface DuelComparisonPanelProps {
  variant: 'result' | 'tie' | 'ended' | 'unresolved'
  winner?: HalfSummary
  loser?: HalfSummary
  both?: [HalfSummary, HalfSummary]
  articleTitle: string
  lang: 'fr' | 'en'
  shareSlot?: React.ReactNode
  onHome: () => void
}

function fmtDuration(sec: number | null): string {
  if (sec === null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function DuelComparisonPanel({
  variant, winner, loser, both, articleTitle, lang, shareSlot, onHome,
}: DuelComparisonPanelProps) {
  const t = lang === 'fr'
    ? {
        resultHeading: 'Résultat du duel',
        tieHeading: 'Égalité !',
        endedHeading: 'Duel terminé',
        unresolvedHeading: 'Duel expiré',
        articleLabel: 'Article :',
        guesses: 'essais',
        duration: 'durée',
        found: 'Article trouvé',
        notFound: 'Article non trouvé',
        dnf: 'Abandon',
        tieBadge: '🏅 Égalité',
        unresolvedBody: 'Aucun joueur n\'a terminé avant expiration.',
        home: 'Retour à l\'accueil',
      }
    : {
        resultHeading: 'Duel result',
        tieHeading: 'Tie!',
        endedHeading: 'Duel ended',
        unresolvedHeading: 'Duel expired',
        articleLabel: 'Article:',
        guesses: 'guesses',
        duration: 'duration',
        found: 'Article found',
        notFound: 'Article not found',
        dnf: 'DNF',
        tieBadge: '🏅 Tie',
        unresolvedBody: 'Neither player finished before the duel expired.',
        home: 'Back to home',
      }

  const heading =
    variant === 'result' ? t.resultHeading
    : variant === 'tie' ? t.tieHeading
    : variant === 'ended' ? t.endedHeading
    : t.unresolvedHeading

  const card: React.CSSProperties = {
    maxWidth: 640,
    margin: '0 auto',
    padding: '48px 24px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    boxShadow: 'var(--shadow)',
  }

  const headingStyle: React.CSSProperties = {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 28,
    color: 'var(--text)',
    margin: 0,
    textAlign: 'center',
  }

  const outlineBtn: React.CSSProperties = {
    padding: '12px 24px',
    minHeight: 44,
    borderRadius: 8,
    border: '1px solid var(--accent)',
    backgroundColor: 'transparent',
    color: 'var(--accent)',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  }

  const halfCell = (h: HalfSummary, isWinner: boolean, isTieCell: boolean): React.ReactNode => (
    <div
      style={{
        flex: 1,
        minWidth: 240,
        padding: 24,
        backgroundColor: isWinner ? 'var(--surface)' : 'var(--bg-secondary)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'center',
      }}
    >
      {isWinner && !isTieCell && <div style={{ fontSize: 32 }} aria-label="Winner">🏆</div>}
      <div style={{
        fontFamily: isWinner || isTieCell ? "'DM Serif Display', serif" : 'var(--font-sans)',
        fontSize: isWinner ? 28 : 16,
        color: 'var(--text)',
      }}>
        {h.username}
      </div>
      {h.dnf ? (
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--destructive)' }}>{t.dnf}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-muted)', fontSize: 14 }}>
          <div>{h.guessCount ?? '—'} {t.guesses}</div>
          <div>{fmtDuration(h.durationSec)} {t.duration}</div>
          <div>{h.won ? t.found : t.notFound}</div>
        </div>
      )}
    </div>
  )

  return (
    <section aria-labelledby="duel-comparison-heading" style={card}>
      <h2 id="duel-comparison-heading" style={headingStyle}>{heading}</h2>
      {variant === 'tie' && (
        <div style={{ textAlign: 'center', margin: '12px 0', color: 'var(--accent)', fontSize: 18 }}>
          {t.tieBadge}
        </div>
      )}
      <div style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0 24px' }}>
        {t.articleLabel} {articleTitle}
      </div>

      {variant === 'unresolved' ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 15, marginBottom: 24 }}>
          {t.unresolvedBody}
        </div>
      ) : variant === 'tie' && both ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          {halfCell(both[0], false, true)}
          {halfCell(both[1], false, true)}
        </div>
      ) : winner && loser ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          {halfCell(winner, true, false)}
          {halfCell(loser, false, false)}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        {shareSlot}
        <button type="button" onClick={onHome} style={outlineBtn}>{t.home}</button>
      </div>
    </section>
  )
}
