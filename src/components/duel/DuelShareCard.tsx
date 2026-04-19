'use client'

import React, { useRef } from 'react'
import { buildDuelShareText, type HalfResult } from '@/lib/duel'

// Phase 4 Plan 04 — DuelShareCard (D-19 canonical PNG, D-20 hex-lock).
// These three hex values are the ONLY permitted hex literals under
// src/components/duel/ and src/app/duel/ (enforced by grep gate).
const LIGHT_BG = '#F6F0D7'
const LIGHT_ACCENT = '#5C7A3E'
const LIGHT_TEXT = '#2D2D2D'

type ShareHalf = {
  username: string
  guessCount: number | null
  durationSec: number | null
  won: boolean
  dnf: boolean
}

interface DuelShareCardProps {
  variant: 'winner' | 'tie' | 'ended'
  left: ShareHalf
  right: ShareHalf
  articleTitle: string
  duelUrl: string
  lang: 'fr' | 'en'
  altText: string
  label: string
}

function fmt(n: number | null): string {
  if (n === null) return '—'
  return String(n)
}
function fmtDuration(sec: number | null): string {
  if (sec === null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function DuelShareCard({
  variant,
  left,
  right,
  articleTitle,
  duelUrl,
  lang,
  altText,
  label,
}: DuelShareCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isTie = variant === 'tie'

  const shareText = buildDuelShareText({
    winner: toHalfResult(left),
    loser: toHalfResult(right),
    isTie,
    articleTitle,
    duelUrl,
    lang,
  })

  async function captureAndShare() {
    if (typeof navigator === 'undefined') return
    const nav = navigator as Navigator & {
      share?: (data: { files?: File[]; text?: string }) => Promise<void>
      canShare?: (data: { files?: File[] }) => boolean
    }
    try {
      if (!ref.current) {
        if (typeof nav.share === 'function') await nav.share({ text: shareText })
        return
      }
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(ref.current, {
        scale: 1,
        logging: false,
        useCORS: true,
        backgroundColor: LIGHT_BG,
      })
      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.9))
      if (!blob) {
        if (typeof nav.share === 'function') await nav.share({ text: shareText })
        return
      }
      const file = new File([blob], 'wikifinder-duel.png', { type: 'image/png' })
      if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] }) && typeof nav.share === 'function') {
        await nav.share({ files: [file], text: shareText })
      } else if (typeof nav.share === 'function') {
        await nav.share({ text: shareText })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText)
      }
    } catch {
      // Silent fail — HARD-04 no console
    }
  }

  const halfLabel = lang === 'fr'
    ? { guesses: 'essais', duration: 'durée', dnf: 'Abandon' }
    : { guesses: 'guesses', duration: 'duration', dnf: 'DNF' }

  const title = lang === 'fr' ? 'DUEL WIKIFINDER' : 'WIKIFINDER DUEL'
  const tieLabel = lang === 'fr' ? 'Égalité' : 'Tie'

  return (
    <>
      <button
        type="button"
        onClick={captureAndShare}
        style={{
          padding: '12px 24px',
          minHeight: 44,
          fontSize: 15,
          fontWeight: 600,
          borderRadius: 8,
          border: 'none',
          backgroundColor: 'var(--accent)',
          color: 'white',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {label}
      </button>
      <div
        ref={ref}
        data-duel-share-card
        data-theme="light"
        aria-hidden="true"
        aria-label={altText}
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          width: 1080,
          height: 1080,
          padding: 32,
          backgroundColor: LIGHT_BG,
          color: LIGHT_TEXT,
          border: `2px solid ${LIGHT_ACCENT}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          fontFamily: 'DM Sans, sans-serif',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '0.1em', color: LIGHT_ACCENT }}>
          {title}
        </div>
        {isTie && (
          <div style={{ fontSize: 32, color: LIGHT_ACCENT }}>🏅 {tieLabel}</div>
        )}
        <div style={{ display: 'flex', width: '100%', gap: 24, alignItems: 'stretch', flex: 1 }}>
          <HalfColumn half={left} showTrophy={variant === 'winner'} label={halfLabel} tcolor={LIGHT_TEXT} />
          <div style={{ width: 2, backgroundColor: LIGHT_ACCENT, alignSelf: 'stretch' }} />
          <HalfColumn half={right} showTrophy={false} label={halfLabel} tcolor={LIGHT_TEXT} />
        </div>
        <div style={{ fontSize: 18, color: LIGHT_TEXT, textAlign: 'center' }}>
          {articleTitle} · wikifinder.vercel.app
        </div>
      </div>
    </>
  )
}

function HalfColumn({
  half, showTrophy, label, tcolor,
}: {
  half: ShareHalf
  showTrophy: boolean
  label: { guesses: string; duration: string; dnf: string }
  tcolor: string
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {showTrophy && <div style={{ fontSize: 48 }}>🏆</div>}
      <div style={{ fontSize: 28, fontFamily: "'DM Serif Display', serif", color: tcolor }}>
        {half.username}
      </div>
      {half.dnf ? (
        <div style={{ fontSize: 20, color: tcolor, fontWeight: 600 }}>— {label.dnf}</div>
      ) : (
        <>
          <div style={{ fontSize: 20, color: tcolor }}>
            {fmt(half.guessCount)} {label.guesses}
          </div>
          <div style={{ fontSize: 20, color: tcolor }}>
            {fmtDuration(half.durationSec)} {label.duration}
          </div>
        </>
      )}
    </div>
  )
}

function toHalfResult(h: ShareHalf): HalfResult {
  return {
    userId: '', username: h.username, won: h.won,
    guessCount: h.guessCount, durationSec: h.durationSec, dnf: h.dnf,
  }
}
