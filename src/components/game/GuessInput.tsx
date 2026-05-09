'use client'

import React from 'react'
import { Token, Guess } from '@/app/game/types'

interface GuessInputProps {
    inputRef: React.RefObject<HTMLInputElement | null>
    input: string
    setInput: (value: string) => void
    inputError: string | null
    setInputError: (value: string | null) => void
    handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
    handleGuess: () => void
    submitting: boolean
    tokens: Token[]
    guesses: Guess[]
    guessCount: number
    isMobile: boolean
    scrollToOccurrence: (word: string) => void
    elapsed: number
    won: boolean
    t: {
        history: string
        noWords: string
        attempts: string
        placeholder: string
        validate: string
    }
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

export default function GuessInput({
    inputRef, input, setInput, inputError, setInputError,
    handleKeyDown, handleGuess, submitting,
    tokens, guesses, guessCount, isMobile, scrollToOccurrence, elapsed, won, t,
}: GuessInputProps) {
    const wordTokens = tokens.filter(t => t.type === 'word' && !t.isStopword)
    const revealed = wordTokens.filter(t => t.visible).length
    const total = wordTokens.length
    const pct = total > 0 ? Math.round((revealed / total) * 100) : 0

    return (
        <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 9,
            backgroundColor: 'var(--bg)',
            paddingTop: 12,
            paddingBottom: 16,
            borderBottom: '1px solid var(--border)',
            marginBottom: 24
        }}>

            {isMobile && (
                <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                        {t.history}
                    </div>
                    {guesses.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.noWords}</div>
                    ) : (
                        <div className="no-scrollbar" style={{
                            display: 'flex',
                            gap: 6,
                            alignItems: 'center',
                            overflowX: 'auto',
                            WebkitOverflowScrolling: 'touch',
                            paddingBottom: 2,
                        }}>
                            {guesses.map((g, i) => (
                                <div key={i} onClick={() => g.found && scrollToOccurrence(g.word)}
                                    style={{
                                        backgroundColor: g.found ? 'var(--revealed)' : 'var(--surface)',
                                        border: '1px solid ' + (g.found ? 'var(--accent)' : 'var(--border)'),
                                        padding: '4px 8px', borderRadius: 4, fontSize: 13,
                                        color: g.found ? 'var(--accent)' : 'var(--text-muted)',
                                        fontWeight: g.found ? 600 : 400,
                                        cursor: g.found ? 'pointer' : 'default',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                    }}>
                                    {g.word}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
                        {t.attempts} <span style={{ color: 'var(--text)', fontWeight: 700 }}>{guessCount}</span>
                        <span style={{ marginLeft: 14, fontSize: 13, color: 'var(--text)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                            ⏱ {formatTime(elapsed)}
                        </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                        {pct}%
                    </div>
                </div>
                <div style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'var(--border)',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: 'var(--accent)',
                        borderRadius: 3,
                        transition: 'width 0.4s ease',
                    }} />
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }} className={inputError ? 'input-shake' : ''}>
                    <input ref={inputRef} value={input}
                        onChange={e => { setInput(e.target.value); setInputError(null) }}
                        onKeyDown={handleKeyDown}
                        placeholder={t.placeholder}
                        style={{
                            width: '100%', padding: '12px 16px', fontSize: 16, borderRadius: 8,
                            border: '1px solid ' + (inputError ? '#e53e3e' : 'var(--border)'),
                            backgroundColor: 'var(--surface)', color: 'var(--text)',
                            outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
                        }}
                    />
                    {inputError && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, fontSize: 12, color: '#e53e3e', fontWeight: 500, zIndex: 10, backgroundColor: 'var(--bg)', padding: '2px 4px', borderRadius: 4 }}>
                            {inputError}
                        </div>
                    )}
                </div>
                <button onClick={handleGuess} onMouseDown={e => e.preventDefault()} disabled={!input.trim() || submitting} style={{
                    padding: '12px 24px', fontSize: 15, fontWeight: 600, borderRadius: 8, border: 'none',
                    backgroundColor: 'var(--accent)', color: 'white',
                    cursor: (!input.trim() || submitting) ? 'default' : 'pointer',
                    opacity: (!input.trim() || submitting) ? 0.6 : 1,
                    transition: 'background-color 0.2s', whiteSpace: 'nowrap',
                }}>
                    {submitting ? '...' : t.validate}
                </button>
            </div>
        </div>
    )
}
