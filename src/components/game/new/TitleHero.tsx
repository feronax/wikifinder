'use client'

import React from 'react'
import Mask from '@/components/game/new/Mask'
import type { TitleWord } from '@/app/game/types'

interface TitleHeroProps {
    titleWords: TitleWord[]
    pageId: string
    lang: 'fr' | 'en'
    attemptsCount: number
    // Phase 10.3 P4 — when provided and `won` is true, the banner renders
    // as a clickable button that invokes this callback (opens ResultModal).
    // Backward-compatible: if omitted, the banner is hidden (render-guard).
    onOpenResult?: () => void
    // Mobile-tuned compact layout: smaller padding + title font so more of
    // the article body is visible above the fold. Desktop keeps the
    // original generous spacing.
    compact?: boolean
}

// Offset title token indices by a large constant so title-mask PRNG seeds
// never collide with article-body token seeds on the same pageId (D-04
// determinism preserved).
const TITLE_INDEX_OFFSET = 1_000_000

export default function TitleHero({ titleWords, pageId, lang, attemptsCount, onOpenResult, compact = false }: TitleHeroProps) {
    const total = titleWords.filter(w => !w.isStopword).length
    const found = titleWords.filter(w => !w.isStopword && w.revealed).length
    const pct = total === 0 ? 0 : (found / total) * 100
    const won = total > 0 && found === total

    return (
        <section
            style={{
                background: 'var(--wf-surface)',
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius-card)',
                padding: compact ? '14px 18px' : '24px 32px',
                marginBottom: compact ? 12 : 16,
            }}
        >
            <div
                style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '1.4px',
                    color: 'var(--wf-muted)',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--wf-font-ui)',
                }}
            >
                {lang === 'fr' ? 'TITRE' : 'TITLE'}
            </div>

            <h1
                style={{
                    fontFamily: 'var(--wf-font-article)',
                    fontSize: compact ? 28 : 40,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.2,
                    margin: compact ? '6px 0 10px' : '8px 0 12px',
                    color: 'var(--wf-ink)',
                }}
            >
                {titleWords.map((tw, i) => {
                    const sep = i > 0 ? ' ' : ''
                    if (tw.isStopword) {
                        return (
                            <React.Fragment key={tw.index}>
                                {sep}
                                <span style={{ color: 'var(--wf-ink)' }}>{tw.value}</span>
                            </React.Fragment>
                        )
                    }
                    // Render Mask directly in the h1 inline flow (matches
                    // design-proto game.jsx:208-225). The prior inline-block
                    // min-width wrapper was added to compensate for the D-05
                    // PRNG jitter making short-word masks unreadable at 40px.
                    // Since Bug B removed that jitter (width is now exactly
                    // length × 0.56em), the wrapper is unnecessary and its
                    // baseline reset broke mask vs text vertical alignment.
                    return (
                        <React.Fragment key={tw.index}>
                            {sep}
                            <Mask
                                word={tw.value}
                                wordLength={tw.length}
                                pageId={pageId}
                                tokenIndex={tw.index + TITLE_INDEX_OFFSET}
                                revealed={tw.revealed}
                                justRevealed={false}
                                highlighted={false}
                                lang={lang}
                            />
                        </React.Fragment>
                    )
                })}
            </h1>

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

            {won && onOpenResult && (
                <button
                    type="button"
                    onClick={onOpenResult}
                    style={{
                        marginTop: 12,
                        padding: '10px 14px',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--wf-accent)',
                        fontFamily: 'var(--wf-font-ui)',
                        background: 'transparent',
                        border: '1px solid var(--wf-accent)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    {lang === 'fr'
                        ? `Voir le résultat — en ${attemptsCount} tentatives →`
                        : `View result — in ${attemptsCount} attempts →`}
                </button>
            )}
        </section>
    )
}
