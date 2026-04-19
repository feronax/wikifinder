'use client'

import React, { useRef } from 'react'

interface SurvivalShareCardProps {
  chain: { outcome: 'completed' | 'gave_up' }[]
  chainLength: number
  score: number
  shareText: string
  altText: string
  label: string
}

// Forced light-theme palette per UI-SPEC §Surface 5 — share card must render a
// consistent PNG regardless of OS/theme. These three hex values are the ONLY
// permitted hex literals in Phase 3 code (I-2 lock 2026-04-18):
const LIGHT_BG = '#F6F0D7'       // --bg in light theme
const LIGHT_ACCENT = '#5C7A3E'   // --accent in light theme (brand green)
const LIGHT_TEXT = '#2D2D2D'     // --text in light theme

export default function SurvivalShareCard({
  chain,
  chainLength,
  score,
  shareText,
  altText,
  label,
}: SurvivalShareCardProps) {
  const ref = useRef<HTMLDivElement>(null)

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
      const file = new File([blob], 'wikifinder-survival.png', { type: 'image/png' })
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
        data-survival-share-card
        data-theme="light"
        aria-hidden="true"
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
          justifyContent: 'center',
          gap: 48,
          fontFamily: 'DM Sans, sans-serif',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '0.1em', color: LIGHT_ACCENT }}>
          WIKIFINDER SURVIVAL
        </div>
        <div
          style={{
            fontSize: 48,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 900,
          }}
          aria-label={altText}
        >
          {chain.map((entry, i) => (
            <span key={i} aria-hidden="true">
              {entry.outcome === 'completed' ? '\uD83D\uDFE9' : '\uD83D\uDFE5'}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 28, fontFamily: "'DM Serif Display', serif" }}>
          Chain {chainLength} · Score {score.toLocaleString()}
        </div>
        <div style={{ fontSize: 14, color: LIGHT_TEXT }}>
          wikifinder.vercel.app
        </div>
      </div>
    </>
  )
}
