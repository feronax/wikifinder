import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ArticleBody from './ArticleBody'
import type { Token } from '@/app/game/types'

afterEach(() => cleanup())

function makeWord(index: number, value: string, opts: Partial<Token> = {}): Token {
  return {
    index,
    type: 'word',
    value,
    visible: false,
    isStopword: false,
    isHeading: false,
    length: value.length,
    ...opts,
  }
}

function makeSpace(index: number): Token {
  return { index, type: 'space', value: ' ' }
}

describe('ArticleBody — stopword + visible rendering (Bug 1)', () => {
  it('renders stopword word tokens as plain text (not masked)', () => {
    const tokens: Token[] = [
      makeWord(0, 'Le', { isStopword: true, visible: true }),
      makeSpace(1),
      makeWord(2, '', { isStopword: false, visible: false }), // masked real word
    ]
    const { container } = render(
      <ArticleBody
        tokens={tokens}
        pageId="p1"
        foundSet={new Set()}
        justRevealedWord={null}
        highlightedWord={null}
        lang="fr"
      />,
    )
    // Stopword text must appear in the DOM
    expect(container.textContent).toContain('Le')
    // Stopword span should NOT have aria-label "mot masqué"
    const masks = container.querySelectorAll('[aria-label^="mot masqué"]')
    expect(masks.length).toBe(1) // only the non-stopword masked word
  })

  it('renders server-revealed word tokens (visible=true, has value) as revealed text, not mask', () => {
    const tokens: Token[] = [
      makeWord(0, 'ordinateur', { isStopword: false, visible: true }), // server pre-revealed
    ]
    const { container } = render(
      <ArticleBody
        tokens={tokens}
        pageId="p1"
        foundSet={new Set()}
        justRevealedWord={null}
        highlightedWord={null}
        lang="fr"
      />,
    )
    expect(container.textContent).toContain('ordinateur')
    expect(container.querySelectorAll('[aria-label^="mot masqué"]').length).toBe(0)
  })

  it('renders heading stopwords as plain text inside <h2>', () => {
    const tokens: Token[] = [
      makeWord(0, 'De', { isStopword: true, visible: true, isHeading: true }),
      makeSpace(1),
      makeWord(2, '', { isStopword: false, visible: false, isHeading: true }),
    ]
    const { container } = render(
      <ArticleBody
        tokens={tokens}
        pageId="p1"
        foundSet={new Set()}
        justRevealedWord={null}
        highlightedWord={null}
        lang="fr"
      />,
    )
    const h2 = container.querySelector('h2')
    expect(h2).not.toBeNull()
    expect(h2!.textContent).toContain('De')
    // Only the non-stopword heading word is masked
    expect(h2!.querySelectorAll('[aria-label^="mot masqué"]').length).toBe(1)
  })

  it('masks non-stopword unrevealed words normally', () => {
    const tokens: Token[] = [
      makeWord(0, '', { isStopword: false, visible: false }),
      makeSpace(1),
      makeWord(2, '', { isStopword: false, visible: false }),
    ]
    const { container } = render(
      <ArticleBody
        tokens={tokens}
        pageId="p1"
        foundSet={new Set()}
        justRevealedWord={null}
        highlightedWord={null}
        lang="fr"
      />,
    )
    expect(container.querySelectorAll('[aria-label^="mot masqué"]').length).toBe(2)
  })
})
