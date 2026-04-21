'use client'

import React from 'react'
import { computeMaskWidth } from '@/lib/mask-width'
import { normalize } from '@/lib/matching'

type MaskProps = {
    word: string
    pageId: string
    tokenIndex: number
    revealed: boolean
    justRevealed: boolean
    highlighted: boolean
    lang: 'fr' | 'en'
}

function MaskImpl({ word, pageId, tokenIndex, revealed, justRevealed, highlighted, lang }: MaskProps) {
    const dataWord = normalize(word)

    if (revealed) {
        // justRevealed wins over highlighted when both are true (explicit priority).
        const animationStyle: React.CSSProperties = justRevealed
            ? { animation: 'wf-flash 400ms linear, wf-fade 600ms 400ms ease-out' }
            : highlighted
                ? { animation: 'wf-pulse 500ms cubic-bezier(.4,.4,0,1.2)' }
                : {}

        return (
            <span
                data-word={dataWord}
                style={{
                    color: 'var(--wf-accent)',
                    textDecoration: 'underline dotted var(--wf-accent)',
                    textUnderlineOffset: '3px',
                    transition: 'color 160ms',
                    ...animationStyle,
                }}
            >
                {word}
            </span>
        )
    }

    const w = computeMaskWidth(pageId, tokenIndex, word.length)

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
    prev.tokenIndex === next.tokenIndex &&
    prev.pageId === next.pageId &&
    prev.revealed === next.revealed &&
    prev.justRevealed === next.justRevealed &&
    prev.highlighted === next.highlighted &&
    prev.lang === next.lang
)
