'use client'

import React, { useRef, useState } from 'react'
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
    proximityHint?: { score: number; word: string }
}

function proximityColor(score: number): string {
    if (score >= 0.80) return 'var(--wf-proximity-hot)'
    if (score >= 0.65) return 'var(--wf-proximity-warm)'
    return 'var(--wf-proximity-cold)'  // 0.55–0.65 range (PROXIMITY_THRESHOLD = 0.55)
}

function MaskImpl({ word, wordLength, pageId, tokenIndex, revealed, justRevealed, highlighted, lang, proximityHint }: MaskProps) {
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
                    color: activeAmber ? 'var(--wf-accent-text-on-light)' : 'var(--wf-ink)',
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

    return <UnrevealedMask
        dataWord={dataWord}
        effectiveLength={effectiveLength}
        pageId={pageId}
        tokenIndex={tokenIndex}
        lang={lang}
        proximityHint={proximityHint}
    />
}

// Hooks isolated in their own component so the revealed-state branch carries
// no hook overhead — load-bearing for the sacred <50ms reveal budget. When a
// guess reveals N tokens, this UnrevealedMask unmounts cleanly and the
// revealed branch above mounts as a pure dumb span.
function UnrevealedMask({
    dataWord, effectiveLength, pageId, tokenIndex, lang, proximityHint,
}: {
    dataWord: string
    effectiveLength: number
    pageId: string
    tokenIndex: number
    lang: 'fr' | 'en'
    proximityHint?: { score: number; word: string }
}) {
    const innerRef = useRef<HTMLSpanElement>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [showingCount, setShowingCount] = useState(false)

    const handleTap = () => {
        if (!proximityHint) {
            // Existing behavior: flash letter count for 1s then hide
            const el = innerRef.current
            if (!el) return
            el.style.opacity = '1'
            if (timerRef.current !== null) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => {
                if (innerRef.current) innerRef.current.style.opacity = '0'
                timerRef.current = null
            }, 1000)
        } else {
            // Inverted behavior (D-09): temporarily show letter count, revert to word text
            if (timerRef.current !== null) clearTimeout(timerRef.current)
            setShowingCount(true)
            timerRef.current = setTimeout(() => {
                setShowingCount(false)
                timerRef.current = null
            }, 1000)
        }
    }

    const w = computeMaskWidth(pageId, tokenIndex, effectiveLength)

    return (
        <span
            data-word={dataWord}
            role="button"
            tabIndex={0}
            aria-label={
                proximityHint
                    ? lang === 'fr'
                        ? `mot masqué de ${effectiveLength} lettres, proche de « ${proximityHint.word} »`
                        : `masked word, ${effectiveLength} letters, close to "${proximityHint.word}"`
                    : lang === 'fr'
                        ? `mot masqué de ${effectiveLength} lettres`
                        : `masked word, ${effectiveLength} letters`
            }
            onClick={handleTap}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleTap()
                }
            }}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                // When showing the hint word, expand to fit it; use mask width as minimum
                // so the block never shrinks below the word's natural masked size.
                width: (proximityHint && !showingCount) ? 'auto' : `${w}em`,
                minWidth: (proximityHint && !showingCount) ? `${w}em` : undefined,
                height: '1.1em',
                background: 'var(--wf-mask)',
                border: '1px solid var(--wf-mask-edge)',
                borderRadius: 'var(--wf-radius)',
                transform: 'translateY(-0.08em)',
                margin: '0 1px',
                verticalAlign: 'baseline',
                cursor: 'pointer',
                fontSize: '0.7em',
                fontVariantNumeric: 'tabular-nums',
                userSelect: 'none',
                // Proximity hint additions (D-06, D-07, D-09, D-11, UI-SPEC)
                color: proximityHint ? proximityColor(proximityHint.score) : 'var(--wf-muted)',
                fontWeight: proximityHint ? 500 : undefined,
                padding: proximityHint ? '0 4px' : undefined,
                transition: 'color 200ms ease-out',
            }}
        >
            {proximityHint && !showingCount ? (
                <span aria-hidden="true">
                    {proximityHint.word}
                </span>
            ) : (
                <span
                    ref={innerRef}
                    aria-hidden="true"
                    style={{
                        opacity: proximityHint ? 1 : 0,
                        transition: 'opacity 300ms ease-out',
                    }}
                >
                    {effectiveLength}
                </span>
            )}
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
    prev.lang === next.lang &&
    prev.proximityHint?.score === next.proximityHint?.score &&
    prev.proximityHint?.word === next.proximityHint?.word
)
