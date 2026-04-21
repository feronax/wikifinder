'use client'

import React, { useLayoutEffect, useRef } from 'react'
import Mask from '@/components/game/new/Mask'
import { normalize } from '@/lib/matching'
import type { Token } from '@/app/game/types'

interface ArticleBodyProps {
    tokens: Token[]
    pageId: string
    foundSet: Set<string>
    justRevealedWord: string | null
    highlightedWord: string | null
    lang: 'fr' | 'en'
}

/**
 * Render a single word token into either:
 *   - plain text (stopword: ink color),
 *   - revealed text (visible=true, non-stopword: accent + dotted underline),
 *   - a Mask (otherwise).
 *
 * Ported from legacy TokenRenderer.tsx which short-circuits the stopword /
 * tk.visible cases before producing a masked span. Bug 1 (Phase 9 UAT) was
 * that every word token went through Mask here, turning stopwords and
 * server-pre-revealed words into dark squares in the article body.
 */
function renderWordToken(
    tk: Token,
    pageId: string,
    foundSet: Set<string>,
    justRevealedWord: string | null,
    highlightedWord: string | null,
    lang: 'fr' | 'en',
): React.ReactNode {
    // Stopword: plain ink text. Server sets value to the real token for stopwords.
    if (tk.isStopword) {
        return <span key={tk.index}>{tk.value}</span>
    }
    // Server pre-revealed (visible=true): render as revealed accent text.
    if (tk.visible) {
        return (
            <span
                key={tk.index}
                style={{
                    color: 'var(--wf-accent)',
                    textDecoration: 'underline dotted var(--wf-accent)',
                    textUnderlineOffset: '3px',
                }}
            >
                {tk.value}
            </span>
        )
    }
    const norm = normalize(tk.value)
    // Server hides unrevealed word values by sending `value: ""` and exposing
    // the character count in `tk.length`. Pass that length to Mask so width
    // can remain proportional to the actual word length (mask.jsx:17).
    const maskLength = (tk.length ?? tk.value.length) || tk.value.length
    return (
        <Mask
            key={tk.index}
            word={tk.value}
            wordLength={maskLength}
            pageId={pageId}
            tokenIndex={tk.index}
            revealed={foundSet.has(norm)}
            justRevealed={norm === justRevealedWord}
            highlighted={norm === highlightedWord}
            lang={lang}
        />
    )
}

export default function ArticleBody({
    tokens,
    pageId,
    foundSet,
    justRevealedWord,
    highlightedWord,
    lang,
}: ArticleBodyProps) {
    // Sacred <50ms CI gate marker — emitted on the null → non-null transition
    // of justRevealedWord, inside useLayoutEffect (synchronous post-commit,
    // pre-paint). Ported verbatim from TokenRenderer.tsx:96-103.
    const lastJustRef = useRef<string | null>(null)
    useLayoutEffect(() => {
        if (justRevealedWord !== null && lastJustRef.current === null) {
            performance.mark('guess:reveal-painted')
        }
        lastJustRef.current = justRevealedWord
    }, [justRevealedWord])

    const elements: React.ReactNode[] = []
    let i = 0

    while (i < tokens.length) {
        const token = tokens[i]

        // Group contiguous isHeading word tokens (plus intra-heading spaces /
        // punctuation) into a single <h2>. Matches the legacy grouping pattern.
        if (token.type === 'word' && token.isHeading) {
            const headingChildren: React.ReactNode[] = []
            while (
                i < tokens.length &&
                (
                    (tokens[i].type === 'word' && tokens[i].isHeading) ||
                    (tokens[i].type === 'space' && !tokens[i].value.includes('\n')) ||
                    tokens[i].type === 'punct'
                )
            ) {
                const tk = tokens[i]
                if (tk.type === 'word') {
                    headingChildren.push(
                        renderWordToken(tk, pageId, foundSet, justRevealedWord, highlightedWord, lang),
                    )
                } else if (tk.type === 'space') {
                    headingChildren.push(tk.value)
                } else {
                    headingChildren.push(<span key={tk.index}>{tk.value}</span>)
                }
                i++
            }
            elements.push(
                <h2
                    key={`h-${token.index}`}
                    style={{
                        fontFamily: 'var(--wf-font-head)',
                        fontSize: 22,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        margin: '20px 0 12px',
                        color: 'var(--wf-ink)',
                    }}
                >
                    {headingChildren}
                </h2>
            )
            continue
        }

        if (token.type === 'word') {
            elements.push(
                renderWordToken(token, pageId, foundSet, justRevealedWord, highlightedWord, lang),
            )
        } else if (token.type === 'space') {
            elements.push(token.value)
        } else {
            elements.push(<span key={token.index}>{token.value}</span>)
        }
        i++
    }

    return (
        <article
            style={{
                background: 'var(--wf-surface)',
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius-card)',
                // Padding + font metrics from design-proto game.jsx:254-261.
                // lineHeight 1.75 + fontSize 17 is what the proto uses; it also
                // matches the line-box the Mask's translateY(-0.08em) was tuned
                // against in mask.jsx, keeping mask tops aligned with adjacent
                // text baselines.
                padding: '32px 40px 40px',
                fontFamily: 'var(--wf-font-article)',
                fontSize: 17,
                lineHeight: 1.75,
                color: 'var(--wf-ink)',
            }}
        >
            {elements}
        </article>
    )
}
