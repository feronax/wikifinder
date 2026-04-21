import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import StatsCard from './StatsCard'
import type { TitleWord } from '@/app/game/types'

afterEach(() => cleanup())

function tw(index: number, value: string, isStopword: boolean, revealed: boolean): TitleWord {
  return { index, value, isStopword, revealed, length: value.length }
}

describe('StatsCard — title-progress segmented bar (Bug 3)', () => {
  it('renders TITRE label and one segment per non-stopword title word', () => {
    const titleWords: TitleWord[] = [
      tw(0, 'Norme', false, true),
      tw(1, 'européenne', false, false),
      tw(2, "d'", true, true), // stopword — not a segment
      tw(3, 'émission', false, false),
    ]
    const { container } = render(
      <StatsCard
        elapsed={0}
        attemptsCount={0}
        foundCount={0}
        totalRevealableTokens={50}
        titleWords={titleWords}
        lang="fr"
      />,
    )
    expect(screen.getByText(/TITRE/)).toBeTruthy()
    const segments = container.querySelectorAll('[data-testid="title-segment"]')
    expect(segments.length).toBe(3) // stopword excluded
  })

  it('marks revealed title segments with accent background', () => {
    const titleWords: TitleWord[] = [
      tw(0, 'A', false, true),
      tw(1, 'B', false, false),
    ]
    const { container } = render(
      <StatsCard
        elapsed={0}
        attemptsCount={0}
        foundCount={0}
        totalRevealableTokens={10}
        titleWords={titleWords}
        lang="fr"
      />,
    )
    const revealed = container.querySelectorAll('[data-testid="title-segment"][data-revealed="true"]')
    const unrevealed = container.querySelectorAll('[data-testid="title-segment"][data-revealed="false"]')
    expect(revealed.length).toBe(1)
    expect(unrevealed.length).toBe(1)
  })

  it('renders EN label when lang=en', () => {
    const titleWords: TitleWord[] = [tw(0, 'Hello', false, false)]
    render(
      <StatsCard
        elapsed={0}
        attemptsCount={0}
        foundCount={0}
        totalRevealableTokens={5}
        titleWords={titleWords}
        lang="en"
      />,
    )
    expect(screen.getByText(/TITLE/)).toBeTruthy()
  })

  it('does not render title progress row when titleWords is empty or all stopwords', () => {
    const titleWords: TitleWord[] = [tw(0, 'de', true, true)]
    const { container } = render(
      <StatsCard
        elapsed={0}
        attemptsCount={0}
        foundCount={0}
        totalRevealableTokens={10}
        titleWords={titleWords}
        lang="fr"
      />,
    )
    expect(container.querySelectorAll('[data-testid="title-segment"]').length).toBe(0)
  })
})
