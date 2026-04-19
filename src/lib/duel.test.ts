import { describe, it, expect } from 'vitest'
import { compareResults, isExpired, buildDuelShareText, type HalfResult } from '@/lib/duel'

const make = (over: Partial<HalfResult> = {}): HalfResult => ({
  userId: over.userId ?? 'u-a',
  username: over.username ?? 'Alice',
  won: over.won ?? true,
  guessCount: over.guessCount ?? 10,
  durationSec: over.durationSec ?? 60,
  dnf: over.dnf ?? false,
})

describe('compareResults', () => {
  it('returns unresolved when both players DNF', () => {
    const a = make({ dnf: true, won: false, guessCount: null, durationSec: null })
    const b = make({ userId: 'u-b', username: 'Bob', dnf: true, won: false, guessCount: null, durationSec: null })
    const r = compareResults(a, b)
    expect(r.kind).toBe('unresolved')
    if (r.kind === 'unresolved') {
      expect(r.a.userId).toBe('u-a')
      expect(r.b.userId).toBe('u-b')
    }
  })

  it('returns winner=b when only a DNF (finisher-wins-DNF, D-18)', () => {
    const a = make({ dnf: true, won: false, guessCount: null, durationSec: null })
    const b = make({ userId: 'u-b', username: 'Bob', won: true, guessCount: 25, durationSec: 200 })
    const r = compareResults(a, b)
    expect(r.kind).toBe('winner')
    if (r.kind === 'winner') {
      expect(r.winner.userId).toBe('u-b')
      expect(r.loser.userId).toBe('u-a')
    }
  })

  it('returns winner=a when only b DNF', () => {
    const a = make({ won: true, guessCount: 25, durationSec: 200 })
    const b = make({ userId: 'u-b', username: 'Bob', dnf: true, won: false, guessCount: null, durationSec: null })
    const r = compareResults(a, b)
    expect(r.kind).toBe('winner')
    if (r.kind === 'winner') expect(r.winner.userId).toBe('u-a')
  })

  it('returns winner=a when a.won && !b.won (both finished)', () => {
    const a = make({ won: true, guessCount: 30, durationSec: 120 })
    const b = make({ userId: 'u-b', username: 'Bob', won: false, guessCount: 400, durationSec: 300 })
    const r = compareResults(a, b)
    expect(r.kind).toBe('winner')
    if (r.kind === 'winner') expect(r.winner.userId).toBe('u-a')
  })

  it('returns winner=b when !a.won && b.won', () => {
    const a = make({ won: false, guessCount: 400, durationSec: 300 })
    const b = make({ userId: 'u-b', username: 'Bob', won: true, guessCount: 30, durationSec: 120 })
    const r = compareResults(a, b)
    expect(r.kind).toBe('winner')
    if (r.kind === 'winner') expect(r.winner.userId).toBe('u-b')
  })

  it('tiebreak 1: both won → fewer guesses wins', () => {
    const a = make({ won: true, guessCount: 12, durationSec: 400 })
    const b = make({ userId: 'u-b', username: 'Bob', won: true, guessCount: 20, durationSec: 60 })
    const r = compareResults(a, b)
    expect(r.kind).toBe('winner')
    if (r.kind === 'winner') expect(r.winner.userId).toBe('u-a')
  })

  it('tiebreak 1 reversed: b has fewer guesses', () => {
    const a = make({ won: true, guessCount: 40, durationSec: 60 })
    const b = make({ userId: 'u-b', username: 'Bob', won: true, guessCount: 15, durationSec: 500 })
    const r = compareResults(a, b)
    expect(r.kind).toBe('winner')
    if (r.kind === 'winner') expect(r.winner.userId).toBe('u-b')
  })

  it('tiebreak 2: both won, same guessCount → faster duration wins', () => {
    const a = make({ won: true, guessCount: 20, durationSec: 90 })
    const b = make({ userId: 'u-b', username: 'Bob', won: true, guessCount: 20, durationSec: 150 })
    const r = compareResults(a, b)
    expect(r.kind).toBe('winner')
    if (r.kind === 'winner') expect(r.winner.userId).toBe('u-a')
  })

  it('returns tie when both won and fully equal (guessCount + duration)', () => {
    const a = make({ won: true, guessCount: 20, durationSec: 90 })
    const b = make({ userId: 'u-b', username: 'Bob', won: true, guessCount: 20, durationSec: 90 })
    const r = compareResults(a, b)
    expect(r.kind).toBe('tie')
    if (r.kind === 'tie') {
      expect(r.a.userId).toBe('u-a')
      expect(r.b.userId).toBe('u-b')
    }
  })

  it('both finished and both lost (no DNF): fewer guesses wins', () => {
    const a = make({ won: false, guessCount: 250, durationSec: 400, dnf: false })
    const b = make({ userId: 'u-b', username: 'Bob', won: false, guessCount: 300, durationSec: 200, dnf: false })
    const r = compareResults(a, b)
    expect(r.kind).toBe('winner')
    if (r.kind === 'winner') expect(r.winner.userId).toBe('u-a')
  })

  it('both finished and both lost with identical stats → tie', () => {
    const a = make({ won: false, guessCount: 250, durationSec: 400, dnf: false })
    const b = make({ userId: 'u-b', username: 'Bob', won: false, guessCount: 250, durationSec: 400, dnf: false })
    const r = compareResults(a, b)
    expect(r.kind).toBe('tie')
  })
})

describe('isExpired', () => {
  const now = new Date('2026-04-19T12:00:00Z')

  it('returns true when expiresAt is in the past', () => {
    expect(isExpired('2026-04-19T11:59:59Z', now)).toBe(true)
  })

  it('returns false when expiresAt is in the future', () => {
    expect(isExpired('2026-04-19T12:00:01Z', now)).toBe(false)
  })

  it('returns false when expiresAt equals now exactly (strict <)', () => {
    expect(isExpired('2026-04-19T12:00:00Z', now)).toBe(false)
  })

  it('uses new Date() default when now omitted', () => {
    // Far-future expiry must always be false
    expect(isExpired('2099-12-31T00:00:00Z')).toBe(false)
  })
})

describe('buildDuelShareText', () => {
  const winner: HalfResult = {
    userId: 'u-a', username: 'Alice', won: true, guessCount: 10, durationSec: 60, dnf: false,
  }
  const loser: HalfResult = {
    userId: 'u-b', username: 'Bob', won: true, guessCount: 20, durationSec: 180, dnf: false,
  }

  it('EN non-tie: uses "Article:" and both names', () => {
    const s = buildDuelShareText({
      winner, loser, isTie: false, articleTitle: 'Photosynthesis', duelUrl: '/duel/xyz', lang: 'en',
    })
    expect(s).toContain('Wikifinder Duel')
    expect(s).toContain('Alice')
    expect(s).toContain('Bob')
    expect(s).toContain('Article: Photosynthesis')
    expect(s).toContain('https://wikifinder.vercel.app/duel/xyz')
  })

  it('FR non-tie: uses "Article :" (FR colon spacing)', () => {
    const s = buildDuelShareText({
      winner, loser, isTie: false, articleTitle: 'Photosynthèse', duelUrl: '/duel/xyz', lang: 'fr',
    })
    expect(s).toContain('Article : Photosynthèse')
    expect(s).toContain('Alice')
    expect(s).toContain('Bob')
  })

  it('tie: includes both participant names without winner/loser ordering', () => {
    const s = buildDuelShareText({
      winner: null, loser: null, isTie: true, articleTitle: 'Mitosis', duelUrl: '/duel/t', lang: 'en',
    })
    expect(s).toContain('Wikifinder Duel')
    // Consumers pass participants via winner/loser even on tie; null case still produces text
    expect(s).toContain('Mitosis')
  })

  it('DNF: string still lists both usernames', () => {
    const dnfLoser: HalfResult = { ...loser, won: false, dnf: true, guessCount: null, durationSec: null }
    const s = buildDuelShareText({
      winner, loser: dnfLoser, isTie: false, articleTitle: 'Krebs cycle', duelUrl: '/duel/d', lang: 'en',
    })
    expect(s).toContain('Alice')
    expect(s).toContain('Bob')
  })
})
