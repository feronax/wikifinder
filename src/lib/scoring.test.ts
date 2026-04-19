import { describe, it, expect } from 'vitest'
import { calculateScore, calculateSurvivalScore } from '@/lib/scoring'

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

describe('calculateSurvivalScore', () => {
  it('returns 0 for empty chain ([], 0)', () => {
    expect(calculateSurvivalScore([], 0)).toBe(0)
  })
  it('returns 0 when all articles given up ([0,0,0], 3) — D-10', () => {
    expect(calculateSurvivalScore([0, 0, 0], 3)).toBe(0)
  })
  it('applies 1.1 multiplier for single article ([5000], 1) === 5500', () => {
    expect(calculateSurvivalScore([5000], 1)).toBe(5500)
  })
  it('applies 2.0 multiplier for 10 articles (Array(10).fill(1000), 10) === 20000', () => {
    expect(calculateSurvivalScore(Array(10).fill(1000), 10)).toBe(20000)
  })
  it('sums non-giveup scores and applies chain multiplier (mixed, 8) === 9000 — D-10', () => {
    expect(calculateSurvivalScore([1000, 1000, 1000, 0, 1000, 0, 1000, 0], 8)).toBe(9000)
  })
  it('rounds integer results ([1234], 7) === 2098', () => {
    expect(calculateSurvivalScore([1234], 7)).toBe(2098)
  })
  it('is a deterministic pure function (no hidden state)', () => {
    const a = calculateSurvivalScore([100, 200], 2)
    const b = calculateSurvivalScore([100, 200], 2)
    expect(a).toBe(b)
  })
  it('treats null/undefined entries as 0 via (s ?? 0) reducer', () => {
    expect(calculateSurvivalScore([1000, null as unknown as number, 2000], 3)).toBe(
      calculateSurvivalScore([1000, 0, 2000], 3)
    )
  })
})
