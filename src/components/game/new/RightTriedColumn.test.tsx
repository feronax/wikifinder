import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import RightTriedColumn from './RightTriedColumn'
import type { FoundWordEntry } from '@/components/game/new/TriedWordRow'

afterEach(() => cleanup())

describe('RightTriedColumn — chip-missed dashed pill (D-02)', () => {
  it('renders missed words as dashed-pill chips', () => {
    render(
      <RightTriedColumn
        found={[]}
        missed={[
          { display: 'foo', normalized: 'foo' },
          { display: 'bar', normalized: 'bar' },
        ]}
        onCycle={vi.fn()}
        lang="fr"
      />,
    )

    const fooEl = screen.getByText('foo') as HTMLElement
    const barEl = screen.getByText('bar') as HTMLElement

    for (const el of [fooEl, barEl]) {
      const style = el.getAttribute('style') ?? ''
      expect(style).toMatch(/dashed/)
      // Accept both serialized forms (jsdom may render as "999px" or "999")
      expect(style).toMatch(/border-radius:\s*999/)
      expect(style).toMatch(/line-through/)
    }
  })

  it('missed chips never use the accent token and live in a flex-wrap container', () => {
    const { container } = render(
      <RightTriedColumn
        found={[]}
        missed={[{ display: 'foo', normalized: 'foo' }]}
        onCycle={vi.fn()}
        lang="fr"
      />,
    )

    const fooEl = screen.getByText('foo') as HTMLElement
    const chipStyle = fooEl.getAttribute('style') ?? ''
    expect(chipStyle).not.toMatch(/var\(--wf-accent\)/)

    // Walk up to parent — must be a flex-wrap container (not a <ul>).
    const parent = fooEl.parentElement as HTMLElement
    expect(parent).toBeTruthy()
    expect(parent.tagName.toLowerCase()).not.toBe('ul')
    const parentStyle = parent.getAttribute('style') ?? ''
    expect(parentStyle).toMatch(/flex-wrap:\s*wrap/)
  })

  it('renders both found chips (via TriedWordRow) and missed chips without regression', () => {
    const found: FoundWordEntry[] = [
      {
        display: 'alpha',
        normalized: 'alpha',
        occurrences: 1,
      },
    ]
    render(
      <RightTriedColumn
        found={found}
        missed={[{ display: 'beta', normalized: 'beta' }]}
        onCycle={vi.fn()}
        lang="fr"
      />,
    )

    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByText('beta')).toBeTruthy()
  })
})
