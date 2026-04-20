'use client'

import React, { useRef } from 'react'

// RET-02 / D-22 / D-23 / D-24 — cloned byte-for-byte from SurvivalShareCard
// with the 6 plan-specified mutations. Renders a 1080x1080 offscreen DOM and
// captures via html2canvas on share click. navigator.canShare/share/clipboard
// fallback chain preserved verbatim.

type MaskedTitleWord = {
    revealed: boolean
    text?: string
    width?: number
}

interface DailyShareCardProps {
    streak: number | null // null when anon OR fetch failed → hides chip (D-23)
    score: number
    maskedTitleWords: MaskedTitleWord[]
    articleDate: string // ISO YYYY-MM-DD
    lang: 'fr' | 'en'
    shareText: string
    altText: string
    label: string
}

// Forced light-theme palette per UI-SPEC §Surface 5 — share card must render a
// consistent PNG regardless of OS/theme. These three hex values are the ONLY
// permitted hex literals in Phase 5 scope for this file (D-24 lock):
const LIGHT_BG = '#F6F0D7' // --bg in light theme
const LIGHT_ACCENT = '#5C7A3E' // --accent in light theme (brand green)
const LIGHT_TEXT = '#2D2D2D' // --text in light theme

export default function DailyShareCard({
    streak,
    score,
    maskedTitleWords,
    articleDate,
    lang,
    shareText,
    altText,
    label,
}: DailyShareCardProps) {
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
            const file = new File([blob], 'wikifinder-daily.png', { type: 'image/png' })
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

    let formattedDate = articleDate
    try {
        const d = new Date(articleDate)
        if (!isNaN(d.getTime())) {
            formattedDate = d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            })
        }
    } catch {
        // keep raw articleDate
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
                data-daily-share-card
                data-theme="light"
                aria-hidden="true"
                aria-label={altText}
                style={{
                    position: 'fixed',
                    left: -9999,
                    top: 0,
                    width: 1080,
                    height: 1080,
                    padding: 48,
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
                <div style={{ fontSize: 18, letterSpacing: 2, color: LIGHT_TEXT }}>
                    WIKIFINDER · {formattedDate}
                </div>

                {/* Masked-title strip — revealed words in DM Serif Display, unrevealed
                    as solid LIGHT_ACCENT boxes (M3). */}
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        justifyContent: 'center',
                        maxWidth: 900,
                        alignItems: 'center',
                    }}
                >
                    {maskedTitleWords.map((w, i) =>
                        w.revealed ? (
                            <span
                                key={i}
                                style={{
                                    fontFamily: "'DM Serif Display', serif",
                                    fontSize: 56,
                                    color: LIGHT_TEXT,
                                    lineHeight: 1.1,
                                }}
                            >
                                {w.text}
                            </span>
                        ) : (
                            <span
                                key={i}
                                aria-hidden
                                style={{
                                    display: 'inline-block',
                                    width: w.width ?? 80,
                                    height: 48,
                                    background: LIGHT_ACCENT,
                                    borderRadius: 4,
                                }}
                            />
                        )
                    )}
                </div>

                {/* Stats line — streak chip conditional on streak != null && > 0 (D-23). */}
                <div
                    style={{
                        display: 'flex',
                        gap: 16,
                        fontSize: 28,
                        color: LIGHT_TEXT,
                        alignItems: 'center',
                        fontFamily: "'DM Serif Display', serif",
                    }}
                >
                    {streak !== null && streak > 0 && (
                        <span
                            style={{
                                background: LIGHT_ACCENT,
                                color: LIGHT_BG,
                                padding: '8px 16px',
                                borderRadius: 8,
                                fontWeight: 600,
                                fontFamily: 'DM Sans, sans-serif',
                            }}
                        >
                            {lang === 'fr' ? `🔥 Série ${streak}` : `🔥 Streak ${streak}`}
                        </span>
                    )}
                    <span style={{ fontWeight: 600 }}>
                        {lang === 'fr' ? `Score ${score.toLocaleString()}` : `Score ${score.toLocaleString()}`}
                    </span>
                </div>

                <div style={{ fontSize: 14, color: LIGHT_TEXT }}>wikifinder.vercel.app</div>
            </div>
        </>
    )
}
