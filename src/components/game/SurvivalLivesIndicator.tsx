'use client'

import React from 'react'

interface SurvivalLivesIndicatorProps {
    livesRemaining: 0 | 1 | 2 | 3
    total?: number
    t: {
        livesAria: (n: number, total: number) => string
    }
}

export default function SurvivalLivesIndicator({
    livesRemaining,
    total = 3,
    t,
}: SurvivalLivesIndicatorProps) {
    const slots = Array.from({ length: total }, (_, i) => i < livesRemaining)
    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={t.livesAria(livesRemaining, total)}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
            }}
        >
            {slots.map((filled, i) => (
                <span
                    key={i}
                    aria-hidden="true"
                    style={{
                        fontSize: 20,
                        lineHeight: 1,
                        display: 'inline-block',
                        width: 20,
                        height: 20,
                        textAlign: 'center',
                    }}
                >
                    {filled ? '❤️' : '🩶'}
                </span>
            ))}
        </div>
    )
}
