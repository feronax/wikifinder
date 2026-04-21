'use client'

import React from 'react'
import Mask from '@/components/game/new/Mask'
import type { TitleWord } from '@/app/game/types'

interface TitleHeroProps {
    titleWords: TitleWord[]
    pageId: string
    lang: 'fr' | 'en'
    attemptsCount: number
}

// Offset title token indices by a large constant so title-mask PRNG seeds
// never collide with article-body token seeds on the same pageId (D-04
// determinism preserved).
const TITLE_INDEX_OFFSET = 1_000_000

export default function TitleHero({ titleWords, pageId, lang, attemptsCount }: TitleHeroProps) {
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
                padding: '24px 32px',
                marginBottom: 16,
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
                    fontSize: 40,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.2,
                    margin: '8px 0 12px',
                    color: 'var(--wf-ink)',
                    // Explicit flex wrap so adjacent stopword spans and Mask
                    // inline-blocks keep even spacing, even when the whitespace
                    // text node gets visually-collapsed at 40px tracking
                    // (Bug 2 — "tiny squares" symptom).
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    gap: '0.25em',
                }}
            >
                {titleWords.map((tw) => {
                    if (tw.isStopword) {
                        return (
                            <span key={tw.index} style={{ color: 'var(--wf-ink)' }}>
                                {tw.value}
                            </span>
                        )
                    }
                    // Wrap the mask in a min-width container so short title
                    // words (length 1-3) don't render as visually-square
                    // micro-blocks at 40px font-size. min-width: 1.8em at 40px
                    // ≈ 72px, which preserves a legible rectangular silhouette.
                    return (
                        <span
                            key={tw.index}
                            style={{
                                display: 'inline-flex',
                                minWidth: '1.8em',
                                alignItems: 'baseline',
                            }}
                        >
                            <Mask
                                word={tw.value}
                                pageId={pageId}
                                tokenIndex={tw.index + TITLE_INDEX_OFFSET}
                                revealed={tw.revealed}
                                justRevealed={false}
                                highlighted={false}
                                lang={lang}
                            />
                        </span>
                    )
                })}
            </h1>

            <div
                style={{
                    height: 6,
                    background: 'var(--wf-bg2)',
                    borderRadius: 3,
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

            {won && (
                <div
                    style={{
                        marginTop: 12,
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--wf-accent)',
                        fontFamily: 'var(--wf-font-ui)',
                    }}
                >
                    {lang === 'fr'
                        ? 'Titre trouvé en ' + attemptsCount + ' tentatives'
                        : 'Title found in ' + attemptsCount + ' attempts'}
                </div>
            )}
        </section>
    )
}
