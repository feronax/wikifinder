'use client'

import React from 'react'
import SurvivalChainTrail from './SurvivalChainTrail'

interface SurvivalResultsPanelProps {
    score: number
    chain: { outcome: 'completed' | 'gave_up' }[]
    durationSec: number
    onShare: () => void
    onPlayAgain: () => void
    t: {
        headline: string
        scoreLabel: string
        metaLine: (chainLength: number, duration: string) => string
        shareCta: string
        replayCta: string
        trailAria?: (total: number, cleared: number, gaveUp: number, score: number) => string
    }
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

export default function SurvivalResultsPanel({
    score,
    chain,
    durationSec,
    onShare,
    onPlayAgain,
    t,
}: SurvivalResultsPanelProps) {
    const chainLength = chain.length
    const cleared = chain.filter(e => e.outcome === 'completed').length
    const gaveUp = chainLength - cleared
    const trailAria = t.trailAria ? t.trailAria(chainLength, cleared, gaveUp, score) : undefined

    return (
        <div
            style={{
                maxWidth: 640,
                margin: '0 auto',
                padding: '48px 24px',
                backgroundColor: 'var(--surface)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow)',
                textAlign: 'center',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text)',
            }}
        >
            <h1
                style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 28,
                    fontWeight: 400,
                    lineHeight: 1.2,
                    marginBottom: 32,
                    color: 'var(--text)',
                }}
            >
                {t.headline}
            </h1>
            <div
                style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                }}
            >
                {t.scoreLabel}
            </div>
            <div
                style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 28,
                    fontWeight: 400,
                    color: 'var(--accent)',
                    marginBottom: 16,
                    lineHeight: 1.2,
                }}
            >
                {score.toLocaleString()}
            </div>
            <div
                style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    marginBottom: 32,
                }}
            >
                {t.metaLine(chainLength, formatDuration(durationSec))}
            </div>
            <div style={{ marginBottom: 40 }}>
                <SurvivalChainTrail chain={chain} ariaLabel={trailAria} />
            </div>
            <div
                style={{
                    display: 'flex',
                    gap: 12,
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                }}
            >
                <button
                    type="button"
                    onClick={onShare}
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
                    {t.shareCta}
                </button>
                <button
                    type="button"
                    onClick={onPlayAgain}
                    style={{
                        padding: '12px 24px',
                        minHeight: 44,
                        fontSize: 15,
                        fontWeight: 600,
                        borderRadius: 8,
                        border: '1px solid var(--accent)',
                        backgroundColor: 'transparent',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                    }}
                >
                    {t.replayCta}
                </button>
            </div>
        </div>
    )
}
