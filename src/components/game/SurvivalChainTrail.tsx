'use client'

import React from 'react'

interface SurvivalChainTrailProps {
    chain: { outcome: 'completed' | 'gave_up' }[]
    ariaLabel?: string
}

export default function SurvivalChainTrail({
    chain,
    ariaLabel,
}: SurvivalChainTrailProps) {
    return (
        <div
            role="img"
            aria-label={ariaLabel}
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 4,
                fontSize: 20,
                lineHeight: 1,
                maxWidth: '100%',
            }}
        >
            {chain.map((entry, i) => (
                <span
                    key={i}
                    aria-hidden="true"
                    style={{
                        display: 'inline-block',
                        width: 20,
                        height: 20,
                        textAlign: 'center',
                    }}
                >
                    {entry.outcome === 'completed' ? '🟩' : '🟥'}
                </span>
            ))}
        </div>
    )
}
