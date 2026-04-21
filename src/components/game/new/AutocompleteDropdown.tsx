'use client'

import React from 'react'
import { normalize } from '@/lib/matching'

interface AutocompleteDropdownProps {
  input: string
  foundWordsByRecency: string[]
  activeIndex: number
  onSelect: (word: string) => void
  onHoverIndex: (idx: number) => void
  lang: 'fr' | 'en'
}

export default function AutocompleteDropdown({
  input,
  foundWordsByRecency,
  activeIndex,
  onSelect,
  onHoverIndex,
}: AutocompleteDropdownProps) {
  const norm = normalize(input)
  const suggestions = foundWordsByRecency
    .filter((w) => {
      const nw = normalize(w)
      return nw.startsWith(norm) && nw !== norm
    })
    .slice(0, 5)

  if (input.trim() === '' || suggestions.length === 0) return null

  return (
    <ul
      role="listbox"
      id="wf-autocomplete"
      style={{
        listStyle: 'none',
        padding: 0,
        margin: '8px 0 0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
      }}
    >
      {suggestions.map((w, i) => {
        const selected = i === activeIndex
        return (
          <li
            role="option"
            id={'wf-ac-opt-' + i}
            aria-selected={selected}
            key={w}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(w)}
            onMouseEnter={() => onHoverIndex(i)}
            style={{
              padding: '3px 8px',
              fontSize: 12,
              fontFamily: 'var(--wf-font-ui)',
              border:
                '1px solid ' +
                (selected ? 'var(--wf-accent)' : 'var(--wf-border)'),
              color: selected ? 'var(--wf-ink)' : 'var(--wf-muted)',
              background: selected ? 'var(--wf-bg2)' : 'transparent',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            {w}
          </li>
        )
      })}
    </ul>
  )
}
