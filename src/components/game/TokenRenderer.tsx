'use client'

import React from 'react'
import { Token } from '@/app/game/types'

interface TokenRendererProps {
    tokens: Token[]
    revealAll: boolean
    hintTokenIndex: number | null
    justRevealedTokens: Set<number>
    showHint: (index: number) => void
}

export default function TokenRenderer({ tokens, revealAll, hintTokenIndex, justRevealedTokens, showHint }: TokenRendererProps) {
    const elements: React.ReactNode[] = []
    let i = 0

    while (i < tokens.length) {
        const token = tokens[i]

        if (token.type === 'word' && token.isHeading) {
            const headingTokens: React.ReactNode[] = []
            const level = token.headingLevel || 2

            while (i < tokens.length && (
                (tokens[i].type === 'word' && tokens[i].isHeading) ||
                (tokens[i].type === 'space' && !tokens[i].value.includes('\n'))
            )) {
                const tk = tokens[i]
                if (tk.type === 'space') {
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
                    const idx = i
                    const showHintNow = hintTokenIndex === idx
                    headingTokens.push(
                        <span key={i} onClick={() => showHint(idx)} style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: 'var(--masked)', borderRadius: 3,
                            minWidth: `${(tk.length || 3) * 8}px`, height: '1.2em',
                            verticalAlign: 'middle', margin: '0 1px',
                            cursor: 'pointer', fontSize: 9, fontWeight: 700,
                            color: showHintNow ? 'var(--text)' : 'transparent',
                            transition: 'color 0.15s', userSelect: 'none',
                        }}>
                            {tk.length}
                        </span>
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
                const idx = i
                const showHintNow = hintTokenIndex === idx
                lineTokens.push(
                    <span key={i} onClick={() => showHint(idx)} style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'var(--masked)', borderRadius: 3,
                        minWidth: `${(tk.length || 3) * 8}px`, height: '1.5em',
                        verticalAlign: 'middle', margin: '0 1px',
                        cursor: 'pointer', fontSize: 10, fontWeight: 700,
                        color: showHintNow ? 'var(--text)' : 'transparent',
                        transition: 'color 0.15s', userSelect: 'none',
                    }}>
                        {tk.length}
                    </span>
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
