'use client'

import React from 'react'
import TriedWordRow, { type FoundWordEntry } from '@/components/game/new/TriedWordRow'

export type MissedWordEntry = { display: string; normalized: string }

export interface RightTriedColumnProps {
  found: FoundWordEntry[]
  missed: MissedWordEntry[]
  onCycle: (normalizedWord: string) => void
  lang: 'fr' | 'en'
}

const COPY = {
  fr: { heading: 'MOTS ESSAYÉS', found: 'Trouvés', missed: 'Absents', empty: 'Aucun mot tenté. Commencez par un article, un verbe courant ou un nombre.' },
  en: { heading: 'TRIED WORDS', found: 'Found', missed: 'Missing', empty: 'No words tried yet. Start with an article, a common verb, or a number.' },
} as const

export default function RightTriedColumn({ found, missed, onCycle, lang }: RightTriedColumnProps) {
  const copy = COPY[lang]
  const total = found.length + missed.length
  const isEmpty = found.length === 0 && missed.length === 0

  return (
    <aside style={{
      position: 'sticky',
      top: 80,
      alignSelf: 'flex-start',
      maxHeight: 'calc(100vh - 100px)',
      overflowY: 'auto',
      background: 'var(--wf-surface)',
      border: '1px solid var(--wf-border)',
      borderRadius: 'var(--wf-radius-card)',
      padding: 16,
      minWidth: 0,
      fontFamily: 'var(--wf-font-ui)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1.4,
          color: 'var(--wf-muted)',
          textTransform: 'uppercase',
        }}>{copy.heading}</div>
        <div style={{
          fontSize: 12,
          color: 'var(--wf-faint)',
          fontVariantNumeric: 'tabular-nums',
        }}>{total}</div>
      </div>

      {isEmpty ? (
        <p style={{ fontSize: 13, color: 'var(--wf-muted)', margin: 0 }}>{copy.empty}</p>
      ) : (
        <>
          {found.length > 0 && (
            <>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1,
                color: 'var(--wf-faint)',
                textTransform: 'uppercase',
                margin: '4px 0 8px',
              }}>{copy.found} · {found.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {found.map(entry => (
                  <TriedWordRow key={entry.normalized} entry={entry} onCycle={onCycle} />
                ))}
              </div>
            </>
          )}

          {found.length > 0 && missed.length > 0 && (
            <div style={{ height: 1, background: 'var(--wf-border)', margin: '12px 0' }} />
          )}

          {missed.length > 0 && (
            <>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1,
                color: 'var(--wf-faint)',
                textTransform: 'uppercase',
                margin: '4px 0 8px',
              }}>{copy.missed} · {missed.length}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {missed.map(m => (
                  <li key={m.normalized} style={{
                    padding: '5px 10px',
                    fontSize: 12.5,
                    color: 'var(--wf-faint)',
                    textDecoration: 'line-through',
                    textDecorationColor: 'var(--wf-border-strong)',
                    textDecorationThickness: '1px',
                  }}>{m.display}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </aside>
  )
}
