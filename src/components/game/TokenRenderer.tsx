'use client'

import React, { useLayoutEffect, useRef } from 'react'
import { Token } from '@/app/game/types'

// Runs callback AFTER the browser has actually painted.
// A plain useLayoutEffect measures React commit time (before paint);
// rAF + MessageChannel schedules work after the browser's render steps.
function afterFramePaint(cb: () => void) {
    requestAnimationFrame(() => {
        const mc = new MessageChannel()
        mc.port1.onmessage = () => cb()
        mc.port2.postMessage(0)
    })
}

interface TokenRendererProps {
    tokens: Token[]
    revealAll: boolean
    hintTokenIndex: number | null
    justRevealedTokens: Set<number>
    proximityHints: Map<number, { score: number; word: string }>
    pendingRevealLength: number | null
    showHint: (index: number) => void
}

function MaskedToken({ tk, idx, hintTokenIndex, proximityHint, isPending, showHint, isHeading }: {
    tk: Token
    idx: number
    hintTokenIndex: number | null
    proximityHint: { score: number; word: string } | undefined
    isPending: boolean
    showHint: (index: number) => void
    isHeading?: boolean
}) {
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

export default function TokenRenderer({ tokens, revealAll, hintTokenIndex, justRevealedTokens, proximityHints, pendingRevealLength, showHint }: TokenRendererProps) {
    const lastPendingRef = useRef<number | null>(null)

    useLayoutEffect(() => {
        if (pendingRevealLength !== null && lastPendingRef.current === null) {
            afterFramePaint(() => performance.mark('guess:reveal-painted'))
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
