'use client'

import React from 'react'
import type { FoundWordEntry } from '@/components/game/new/TriedWordRow'

export interface MobileChipStripProps {
  found: FoundWordEntry[]
  onChipClick: (normalizedWord: string) => void
}

export default function MobileChipStrip({ found, onChipClick }: MobileChipStripProps) {
  if (found.length === 0) return null

  return (
    <div
      className="wf-chip-strip-scroller"
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none' as React.CSSProperties['msOverflowStyle'],
        padding: '8px 16px',
        whiteSpace: 'nowrap',
        height: 36 + 16,
        background: 'var(--wf-bg)',
      }}
    >
      {found.map(entry => (
        <button
          key={entry.normalized}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChipClick(entry.normalized)}
          style={{
            flexShrink: 0,
            scrollSnapAlign: 'start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 36,
            padding: '0 12px',
            background: 'var(--wf-bg2)',
            border: '1px solid var(--wf-border)',
            borderLeft: '3px solid var(--wf-accent)',
            borderRadius: 'var(--wf-radius)',
            cursor: 'pointer',
            fontFamily: 'var(--wf-font-ui)',
            fontSize: 14,
            color: 'var(--wf-ink)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>{entry.display}</span>
          {entry.occurrences > 0 && (
            <span style={{
              fontSize: 12,
              color: 'var(--wf-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              ×{entry.occurrences}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
