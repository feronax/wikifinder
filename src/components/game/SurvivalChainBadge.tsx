'use client'

import React from 'react'

interface SurvivalChainBadgeProps {
    length: number
    variant?: 'hud' | 'inline'
    t: {
        chain: (n: number) => string
        chainAria: (n: number) => string
    }
}

export default function SurvivalChainBadge({
    length,
    variant = 'hud',
    t,
}: SurvivalChainBadgeProps) {
    return (
        <span
            role="status"
            aria-label={t.chainAria(length)}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                backgroundColor: variant === 'hud' ? 'var(--surface)' : 'transparent',
                color: 'var(--text)',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'var(--font-sans)',
                whiteSpace: 'nowrap',
            }}
        >
            {t.chain(length)}
        </span>
    )
}
