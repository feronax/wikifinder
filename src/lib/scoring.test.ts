import { describe, it, expect } from 'vitest'
import { calculateScore } from '@/lib/scoring'

describe('calculateScore', () => {
  it('returns 0 when not completed', () => {
    expect(calculateScore(10, false)).toBe(0)
  })
  it('returns 0 when guess count exceeds 400', () => {
    expect(calculateScore(401, true)).toBe(0)
  })
  it('returns 5000 for 1 guess (perfect floor)', () => {
    expect(calculateScore(1, true)).toBe(5000)
  })
  it('returns 5000 at the 45-guess boundary (wRaw clamps to 0)', () => {
    expect(calculateScore(45, true)).toBe(5000)
  })
  it('returns just under 5000 at 46 guesses', () => {
    const s = calculateScore(46, true)
    expect(s).toBeGreaterThan(4900)
    expect(s).toBeLessThan(5000)
  })
  it('returns approximately 151 at 400 guesses (5000 * exp(-3.5))', () => {
    expect(calculateScore(400, true)).toBe(151)
  })
  it('monotonically decreases from 45 to 400', () => {
    const s45 = calculateScore(45, true)
    const s100 = calculateScore(100, true)
    const s200 = calculateScore(200, true)
    const s400 = calculateScore(400, true)
    expect(s45).toBeGreaterThan(s100)
    expect(s100).toBeGreaterThan(s200)
    expect(s200).toBeGreaterThan(s400)
  })
  it('handles 0 guesses when completed (edge: treat as perfect floor)', () => {
    expect(calculateScore(0, true)).toBe(5000)
  })
})
