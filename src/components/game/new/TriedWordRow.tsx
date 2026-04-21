'use client'

import React from 'react'

export type FoundWordEntry = { display: string; normalized: string; occurrences: number }

export interface TriedWordRowProps {
  entry: FoundWordEntry
  onCycle: (normalizedWord: string) => void
}

export default function TriedWordRow({ entry, onCycle }: TriedWordRowProps) {
  return (
    <button
      type="button"
      onClick={() => onCycle(entry.normalized)}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        borderRadius: 'var(--wf-radius)',
        background: 'var(--wf-bg2)',
        border: '1px solid var(--wf-border)',
        borderLeft: '3px solid var(--wf-accent)',
        cursor: 'pointer',
        transition: 'background 120ms, border-color 120ms',
        fontSize: 13,
        fontFamily: 'var(--wf-font-ui)',
        color: 'var(--wf-ink)',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--wf-border-strong)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--wf-border)' }}
    >
      <span style={{ fontWeight: 500 }}>{entry.display}</span>
      <span style={{
        fontSize: 11,
        color: 'var(--wf-accent-ink)',
        background: 'var(--wf-accent)',
        padding: '2px 7px',
        borderRadius: 999,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}>×{entry.occurrences}</span>
    </button>
  )
}
