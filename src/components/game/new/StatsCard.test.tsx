import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import StatsCard from './StatsCard'

afterEach(() => cleanup())

describe('StatsCard — 3-inline layout (handoff §5.1 + proto game.jsx:380-384)', () => {
  it('renders Tentatives, Trouvés, Temps, and ARTICLE RÉVÉLÉ label with percent', () => {
    render(
      <StatsCard
        elapsed={272} // 4:32
        attemptsCount={12}
        foundCount={4}
        totalRevealableTokens={50}
        lang="fr"
      />,
    )
    expect(screen.getByText(/TENTATIVES/)).toBeTruthy()
    expect(screen.getByText(/TROUV/)).toBeTruthy()
    expect(screen.getByText(/TEMPS/)).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('4:32')).toBeTruthy()
    expect(screen.getByText(/ARTICLE R.V.L./)).toBeTruthy()
    // 4/50 = 8%
    expect(screen.getByText('8%')).toBeTruthy()
  })

  it('renders EN labels when lang=en', () => {
    render(
      <StatsCard
        elapsed={0}
        attemptsCount={0}
        foundCount={0}
        totalRevealableTokens={0}
        lang="en"
      />,
    )
    expect(screen.getByText(/ATTEMPTS/)).toBeTruthy()
    expect(screen.getByText(/FOUND/)).toBeTruthy()
    expect(screen.getByText(/TIME/)).toBeTruthy()
    expect(screen.getByText(/ARTICLE REVEALED/)).toBeTruthy()
  })

  it('guards division by zero when totalRevealableTokens is 0', () => {
    render(
      <StatsCard
        elapsed={0}
        attemptsCount={0}
        foundCount={0}
        totalRevealableTokens={0}
        lang="fr"
      />,
    )
    expect(screen.getByText('0%')).toBeTruthy()
  })
})
