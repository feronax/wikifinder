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
                    const norm = normalize(tk.value)
                    headingChildren.push(
                        <Mask
                            key={tk.index}
                            word={tk.value}
                            pageId={pageId}
                            tokenIndex={tk.index}
                            revealed={foundSet.has(norm)}
                            justRevealed={norm === justRevealedWord}
                            highlighted={norm === highlightedWord}
                            lang={lang}
                        />
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
            const norm = normalize(token.value)
            elements.push(
                <Mask
                    key={token.index}
                    word={token.value}
                    pageId={pageId}
                    tokenIndex={token.index}
                    revealed={foundSet.has(norm)}
                    justRevealed={norm === justRevealedWord}
                    highlighted={norm === highlightedWord}
                    lang={lang}
                />
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
                padding: '32px 48px 40px',
                fontFamily: 'var(--wf-font-article)',
                fontSize: 18,
                lineHeight: 1.7,
                color: 'var(--wf-ink)',
            }}
        >
            {elements}
        </article>
    )
}
