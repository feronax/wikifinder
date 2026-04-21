'use client'

import React from 'react'
import { computeMaskWidth } from '@/lib/mask-width'
import { normalize } from '@/lib/matching'

type MaskProps = {
    word: string
    /**
     * Character count of the underlying word. Passed explicitly because the
     * server hides `word` (sends "") for unrevealed tokens; the true length
     * lives on the Token's `length` field. Falls back to word.length when not
     * supplied (callers that still have the raw word in hand).
     */
    wordLength?: number
    pageId: string
    tokenIndex: number
    revealed: boolean
    justRevealed: boolean
    highlighted: boolean
    lang: 'fr' | 'en'
}

function MaskImpl({ word, wordLength, pageId, tokenIndex, revealed, justRevealed, highlighted, lang }: MaskProps) {
    const dataWord = normalize(word)
    const effectiveLength = wordLength ?? word.length

    if (revealed) {
        // Default revealed = plain ink so revealed tokens blend with stopwords
        // and read as prose. Amber + underline only apply when this token is
        // the CURRENTLY-CYCLING word (highlighted) or just-revealed-by-guess
        // (justRevealed) — user wants the amber to mark the active click, not
        // a permanent "you found this" badge.
        const animationStyle: React.CSSProperties = justRevealed
            ? { animation: 'wf-flash 400ms linear, wf-fade 600ms 400ms ease-out' }
            : highlighted
                ? { animation: 'wf-pulse 500ms cubic-bezier(.4,.4,0,1.2)' }
                : {}

        const activeAmber = justRevealed || highlighted

        return (
            <span
                data-word={dataWord}
                style={{
                    color: activeAmber ? 'var(--wf-accent)' : 'var(--wf-ink)',
                    textDecoration: activeAmber
                        ? 'underline dotted var(--wf-accent)'
                        : 'none',
                    textUnderlineOffset: '3px',
                    transition: 'color 160ms',
                    ...animationStyle,
                }}
            >
                {word}
            </span>
        )
    }

    const w = computeMaskWidth(pageId, tokenIndex, effectiveLength)

    return (
        <span
            data-word={dataWord}
            aria-label={lang === 'fr' ? 'mot masqué' : 'masked word'}
            style={{
                display: 'inline-block',
                width: `${w}em`,
                height: '1.1em',
                background: 'var(--wf-mask)',
                border: '1px solid var(--wf-mask-edge)',
                borderRadius: 'var(--wf-radius)',
                transform: 'translateY(-0.08em)',
                margin: '0 1px',
                verticalAlign: 'baseline',
            }}
        >
            &nbsp;
        </span>
    )
}

// Memo pattern from TokenRenderer.tsx:84-91 — load-bearing for the sacred <50ms
// reveal budget. Sibling tokens whose props are reference-equal bail out here
// so a single reveal does not re-render hundreds of masked spans.
export default React.memo(MaskImpl, (prev, next) =>
    prev.word === next.word &&
    prev.wordLength === next.wordLength &&
    prev.tokenIndex === next.tokenIndex &&
    prev.pageId === next.pageId &&
    prev.revealed === next.revealed &&
    prev.justRevealed === next.justRevealed &&
    prev.highlighted === next.highlighted &&
    prev.lang === next.lang
)
