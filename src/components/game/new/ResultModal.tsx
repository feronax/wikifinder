'use client'

import React from 'react'
import { calculateScore } from '@/lib/scoring'
import DailyShareCard from '@/components/game/DailyShareCard'
import ModalShell from './ModalShell'
import type { GameState } from '@/app/game/types'

// Phase 10.3 P2 — minimal post-win ResultModal for the new-design tree.
// Per CONTEXT D-02 this ships content-first: heading + 3-stat row +
// inline DailyShareCard (its own button is the Partager CTA — RESEARCH Q3
// option a) + guarded "Lire sur Wikipédia" link. Phase 12 will polish
// chrome / motion / typography.
//
// Score math (D-05 + RESEARCH Pitfall 3): cosmetic-only hint deduction,
// computed per render — no new GameState field, no new state hook.
//   baseScore = calculateScore(guessCount, won)
//   score     = Math.max(0, baseScore - hintsUsed * 500)

export interface ResultModalProps {
  open: boolean
  onClose: () => void
  gameState: GameState
  chrono: string // pre-formatted chrono, e.g. "02:34"
  streak: number | null // number | null per DailyShareCard Pitfall 2
  lang: 'fr' | 'en'
  hintsUsed?: number // default 0 — P5 will thread the live value in
}

export default function ResultModal({
  open,
  onClose,
  gameState,
  chrono,
  streak,
  lang,
  hintsUsed = 0,
}: ResultModalProps) {
  // Score at render time (D-05). Hints deduction is cosmetic only — the
  // server-side score is the authoritative leaderboard value.
  const baseScore = calculateScore(gameState.guessCount, gameState.won)
  const score = Math.max(0, baseScore - hintsUsed * 500)

  // Wikipedia link comes straight from pageData (D-06 + RESEARCH Q2). The
  // `pageData` type is `any` per game/types.ts, so guard against null/undef.
  const wikipediaUrl: string | null | undefined =
    lang === 'fr'
      ? gameState.pageData?.wikipedia_url_fr
      : gameState.pageData?.wikipedia_url_en

  // Stat cell styles — shape matches StatsCard.tsx labelStyle/numberStyle
  // conventions, retokenized to var(--wf-*).
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--wf-muted)',
    marginBottom: 4,
  }
  const numberStyle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--wf-ink)',
  }

  // DailyShareCard inputs — derived from gameState, matching the legacy
  // page.tsx:1020-1030 derivation so the share PNG stays identical across
  // legacy + new-design paths.
  const articleDate: string =
    gameState.pageData?.date || new Date().toISOString().slice(0, 10)
  const maskedTitleWords = gameState.titleWords.map((tw) => ({
    revealed: tw.revealed || gameState.won,
    text: tw.value,
    width: tw.isStopword
      ? Math.max(20, (tw.length || 3) * 13)
      : Math.max(40, (tw.length || 4) * 18),
  }))
  const shareText =
    lang === 'fr'
      ? `Wikifinder — ${articleDate}\n${gameState.guessCount} tentatives | Score ${score.toLocaleString()}\nhttps://wikifinder.vercel.app/game`
      : `Wikifinder — ${articleDate}\n${gameState.guessCount} guesses | Score ${score.toLocaleString()}\nhttps://wikifinder.vercel.app/game`
  const altText =
    lang === 'fr'
      ? `Wikifinder du ${articleDate} — ${gameState.guessCount} tentatives, score ${score}`
      : `Wikifinder for ${articleDate} — ${gameState.guessCount} guesses, score ${score}`
  const shareLabel = lang === 'fr' ? 'Partager' : 'Share'

  return (
    <ModalShell open={open} onClose={onClose} ariaLabelledBy="result-modal-heading">
      <h2
        id="result-modal-heading"
        style={{
          margin: 0,
          marginRight: 40, // leave room for the close-X
          fontFamily: 'var(--wf-font-head)',
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--wf-ink)',
          lineHeight: 1.2,
        }}
      >
        {lang === 'fr' ? 'Article trouvé !' : 'Article found!'}
      </h2>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 16,
        }}
      >
        <div>
          <div style={labelStyle}>{lang === 'fr' ? 'Tentatives' : 'Attempts'}</div>
          <div style={numberStyle}>{gameState.guessCount}</div>
        </div>
        <div>
          <div style={labelStyle}>{lang === 'fr' ? 'Temps' : 'Time'}</div>
          <div
            style={{
              ...numberStyle,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            }}
          >
            {chrono}
          </div>
        </div>
        <div>
          <div style={labelStyle}>{lang === 'fr' ? 'Points' : 'Score'}</div>
          <div style={numberStyle}>{score}</div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <DailyShareCard
          streak={streak}
          score={score}
          maskedTitleWords={maskedTitleWords}
          articleDate={articleDate}
          lang={lang}
          shareText={shareText}
          altText={altText}
          label={shareLabel}
        />
      </div>

      {wikipediaUrl && (
        <a
          href={wikipediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            marginTop: 12,
            padding: '12px 24px',
            minHeight: 44,
            borderRadius: 8,
            border: '1px solid var(--wf-border)',
            background: 'transparent',
            color: 'var(--wf-ink)',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'var(--wf-font-ui)',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          {lang === 'fr' ? 'Lire sur Wikipédia' : 'Read on Wikipedia'}
        </a>
      )}
    </ModalShell>
  )
}
