'use client'

import React from 'react'
import { TitleWord } from '@/app/game/types'

interface TitleDisplayProps {
    titleWords: TitleWord[]
    won: boolean
    guessCount: number
    score: number
    streak: number | null
    lang: 'fr' | 'en'
    revealAll: boolean
    setRevealAll: (fn: (prev: boolean) => boolean) => void
    wikipediaUrl: string | null | undefined
    shareCopied: boolean
    onShare: () => void
    hintTokenIndex: number | null
    showHint: (index: number) => void
    isMobile: boolean
    titleScoreStyle: React.CSSProperties
    scoreBoxStyle: React.CSSProperties
    t: {
        titleLabel: string
        found: (n: number) => string
        revealAll: string
        hideAll: string
        readArticle: string
        share: string
        copied: string
        score: string
        pts: string
    }
}

export default function TitleDisplay({
    titleWords, won, guessCount, score, streak, lang,
    revealAll, setRevealAll, wikipediaUrl, shareCopied, onShare,
    hintTokenIndex, showHint, isMobile, titleScoreStyle, scoreBoxStyle, t,
}: TitleDisplayProps) {
    return (
        <div style={titleScoreStyle}>
            <div style={{ flex: 1, textAlign: isMobile ? 'center' : 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
                    {t.titleLabel}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', minHeight: 36 }}>
                    {titleWords.map((tw, i) => {
                        const hintIdx = -(i + 1)
                        if (tw.isStopword) {
                            return <span key={i} style={{ fontSize: 22, color: 'var(--text-muted)', fontWeight: 300 }}>{tw.value}</span>
                        }
                        if (tw.revealed || won) {
                            return <span key={i} style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent)' }}>{tw.value}</span>
                        }
                        const blockWidth = Math.max(20, (tw.length || 3) * 13)
                        const showHintNow = hintTokenIndex === hintIdx
                        return (
                            <span key={i} onClick={() => showHint(hintIdx)} style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                backgroundColor: 'var(--masked)', borderRadius: 4,
                                width: blockWidth, height: '1.4em', verticalAlign: 'middle',
                                cursor: 'pointer', fontSize: 13, fontWeight: 700,
                                color: showHintNow ? 'var(--text)' : 'transparent',
                                transition: 'color 0.15s', userSelect: 'none',
                            }}>
                                {tw.length}
                            </span>
                        )
                    })}
                </div>

                {won && (
                    <div style={{ marginTop: 14 }}>
                        <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
                            {t.found(guessCount)}
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                            <button onClick={() => setRevealAll(r => !r)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                {revealAll ? t.hideAll : t.revealAll}
                            </button>
                            {wikipediaUrl && (
                                <a href={wikipediaUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: 13, textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    {t.readArticle}
                                </a>
                            )}
                            <button onClick={onShare} style={{
                                padding: '6px 14px', borderRadius: 6,
                                border: '1px solid var(--accent)',
                                backgroundColor: shareCopied ? 'var(--accent)' : 'transparent',
                                color: shareCopied ? 'white' : 'var(--accent)',
                                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                            }}>
                                {shareCopied ? t.copied : t.share}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {won && (
                <div style={scoreBoxStyle}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{t.score}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{score.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t.pts}</div>
                </div>
            )}
            {won && streak !== null && streak > 0 && (
                <div style={scoreBoxStyle}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Streak</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{streak} 🔥</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{lang === 'fr' ? (streak === 1 ? 'jour' : 'jours') : (streak === 1 ? 'day' : 'days')}</div>
                </div>
            )}
        </div>
    )
}
