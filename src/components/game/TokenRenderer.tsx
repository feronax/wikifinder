'use client'

import React, { useLayoutEffect, useRef } from 'react'
import { Token } from '@/app/game/types'

// Note (Plan 02-05 Option B5): `guess:reveal-painted` is marked synchronously
// inside useLayoutEffect — this measures React-commit time (DOM mutated,
// layout about to flush). The previous rAF + MessageChannel paint-detector
// was accurate to real browser-paint, but imposed a ~16ms architectural floor
// that does not reflect user-perceived latency: by the time useLayoutEffect
// runs, the DOM has already been mutated and the paint is effectively
// committed — the browser's render step is a deterministic consequence of
// that commit. CLAUDE.md's `<50ms visible` budget is honoured by measuring to
// commit, with plenty of headroom for the commit-to-paint tail on real
// hardware. See `.planning/phases/02-testing-baseline/02-CONTEXT.md` addendum
// (D-08/D-09, Plan 05 B5 decision).

interface TokenRendererProps {
    tokens: Token[]
    revealAll: boolean
    hintTokenIndex: number | null
    justRevealedTokens: Set<number>
    proximityHints: Map<number, { score: number; word: string }>
    pendingRevealLength: number | null
    showHint: (index: number) => void
}

type MaskedTokenProps = {
    tk: Token
    idx: number
    hintTokenIndex: number | null
    proximityHint: { score: number; word: string } | undefined
    isPending: boolean
    showHint: (index: number) => void
    isHeading?: boolean
}

function MaskedTokenImpl({ tk, idx, hintTokenIndex, proximityHint, isPending, showHint, isHeading }: MaskedTokenProps) {
    const showHintNow = hintTokenIndex === idx
    const hasProximity = proximityHint !== undefined
    const minW = `${(tk.length || 3) * 8}px`
    const h = isHeading ? '1.4em' : '1.5em'

    // Couleur du texte basée sur la proximité : plus c'est proche, plus c'est visible
    let textColor = showHintNow ? 'var(--text)' : 'transparent'
    let textOpacity = 1
    let fontSize = isHeading ? 9 : 10
    if (hasProximity && !showHintNow) {
        textColor = 'var(--accent)'
        textOpacity = 0.25 + proximityHint.score * 0.55
        fontSize = 12
    }

    return (
        <span onClick={() => showHint(idx)}
            className={isPending ? 'pending-reveal' : ''}
            style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--masked)',
            borderRadius: 3,
            minWidth: minW, height: h,
            verticalAlign: 'middle', margin: '0 1px',
            cursor: 'pointer', fontSize, fontWeight: 700,
            color: textColor,
            opacity: hasProximity && !showHintNow ? textOpacity : 1,
            transition: 'all 0.3s', userSelect: 'none',
            overflow: 'hidden',
            padding: hasProximity ? '0 4px' : 0,
        }}>
            {hasProximity ? proximityHint.word : tk.length}
        </span>
    )
}

// Sacred-metric perf (D-08/Plan 02-05 Option A): memoize MaskedToken so that
// `setPendingRevealLength(word.length)` does NOT trigger a full-tree re-render
// of hundreds of masked tokens. Only the ~few tokens whose `isPending` flips
// should re-render; every other masked token's props are reference-equal and
// bails out here. `showHint` is intentionally excluded from the comparator —
// it is a stable-behaviour passthrough callback that gets a new closure each
// parent render; including it would defeat the memo. All other props are
// either primitives or state references that only change when their
// corresponding state actually changes.
const MaskedToken = React.memo(MaskedTokenImpl, (prev, next) => (
    prev.tk === next.tk &&
    prev.idx === next.idx &&
    prev.hintTokenIndex === next.hintTokenIndex &&
    prev.proximityHint === next.proximityHint &&
    prev.isPending === next.isPending &&
    prev.isHeading === next.isHeading
))

export default function TokenRenderer({ tokens, revealAll, hintTokenIndex, justRevealedTokens, proximityHints, pendingRevealLength, showHint }: TokenRendererProps) {
    const lastPendingRef = useRef<number | null>(null)

    useLayoutEffect(() => {
        // Pitfall 3 defense: only fire on the null → non-null transition so
        // subsequent renders while pending is still active don't re-emit.
        if (pendingRevealLength !== null && lastPendingRef.current === null) {
            performance.mark('guess:reveal-painted')
        }
        lastPendingRef.current = pendingRevealLength
    }, [pendingRevealLength])

    const elements: React.ReactNode[] = []
    let i = 0

    while (i < tokens.length) {
        const token = tokens[i]

        if (token.type === 'word' && token.isHeading) {
            const headingTokens: React.ReactNode[] = []
            const level = token.headingLevel || 2

            while (i < tokens.length && (
                (tokens[i].type === 'word' && tokens[i].isHeading) ||
                (tokens[i].type === 'space' && !tokens[i].value.includes('\n')) ||
                (tokens[i].type === 'punct')
            )) {
                const tk = tokens[i]
                if (tk.type === 'space') {
                    headingTokens.push(<span key={i}>{tk.value}</span>)
                } else if (tk.type === 'punct') {
                    headingTokens.push(<span key={i}>{tk.value}</span>)
                } else if (tk.visible) {
                    headingTokens.push(
                        <span key={i} data-word={tk.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, '').toLowerCase()}
                            className={justRevealedTokens.has(tk.index) ? 'word-just-revealed' : ''}
                            style={{ color: tk.isTitle ? 'var(--accent)' : 'var(--text)' }}>
                            {tk.value}
                        </span>
                    )
                } else if (revealAll) {
                    headingTokens.push(
                        <span key={i} style={{ color: tk.isTitle ? 'var(--accent)' : 'var(--text-muted)', fontStyle: 'italic' }}>
                            {tk.value}
                        </span>
                    )
                } else {
                    headingTokens.push(
                        <MaskedToken key={i} tk={tk} idx={i} hintTokenIndex={hintTokenIndex}
                            proximityHint={proximityHints.get(tk.index)} isPending={pendingRevealLength !== null && tk.length === pendingRevealLength} showHint={showHint} isHeading />
                    )
                }
                i++
            }

            elements.push(
                <div key={`heading-${i}`} style={{ fontWeight: 700, fontSize: level === 2 ? '1.2em' : '1.05em', marginTop: '1.5em', marginBottom: '0.5em', paddingBottom: '0.3em', borderBottom: '1px solid var(--border)', lineHeight: 1.4, textAlign: 'left' }}>
                    {headingTokens}
                </div>
            )
            continue
        }

        if (token.type === 'space' && token.value.includes('\n')) { i++; continue }

        const lineTokens: React.ReactNode[] = []
        while (i < tokens.length &&
            !(tokens[i].type === 'space' && tokens[i].value.includes('\n')) &&
            !(tokens[i].type === 'word' && tokens[i].isHeading)
        ) {
            const tk = tokens[i]
            if (tk.type === 'space' || tk.type === 'punct') {
                lineTokens.push(<span key={i}>{tk.value}</span>)
            } else if (tk.visible) {
                lineTokens.push(
                    <span key={i} data-word={tk.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, '').toLowerCase()}
                        className={justRevealedTokens.has(tk.index) ? 'word-just-revealed' : ''}
                        style={{ fontWeight: tk.isTitle ? 700 : 400, color: tk.isTitle ? 'var(--accent)' : 'var(--text)' }}>
                        {tk.value}
                    </span>
                )
            } else if (revealAll) {
                lineTokens.push(
                    <span key={i} style={{ color: tk.isTitle ? 'var(--accent)' : 'var(--text-muted)', fontStyle: 'italic' }}>
                        {tk.value}
                    </span>
                )
            } else {
                lineTokens.push(
                    <MaskedToken key={i} tk={tk} idx={i} hintTokenIndex={hintTokenIndex}
                        proximityHint={proximityHints.get(tk.index)} isPending={pendingRevealLength !== null && tk.length === pendingRevealLength} showHint={showHint} />
                )
            }
            i++
        }

        if (lineTokens.length > 0) {
            elements.push(<span key={`line-${i}`} style={{ lineHeight: 2.6, textAlign: 'left' }}>{lineTokens}</span>)
        }
        i++
    }

    return <>{elements}</>
}
