import { describe, it, expect } from 'vitest'
import { computeMaskWidth } from './mask-width'

describe('computeMaskWidth', () => {
  it('is deterministic for the same inputs', () => {
    const first = computeMaskWidth('page-x', 5, 7)
    for (let i = 0; i < 100; i++) {
      expect(computeMaskWidth('page-x', 5, 7)).toBe(first)
    }
  })

  it('stays within ±10% jitter of length × 0.55em (design/DESIGN-HANDOFF.md §3)', () => {
    // For any length ≥ 3, base = length × 0.55; width ∈ [base×0.9, base×1.1]
    for (let len = 3; len <= 15; len++) {
      const base = len * 0.55
      const lo = base * 0.9
      const hi = base * 1.1
      for (let idx = 0; idx < 20; idx++) {
        const w = computeMaskWidth('page-a', idx, len)
        expect(w).toBeGreaterThanOrEqual(lo - 1e-9)
        expect(w).toBeLessThanOrEqual(hi + 1e-9)
      }
    }
  })

  it('varies by pageId and tokenIndex (seeded jitter)', () => {
    const widths = new Set<number>()
    for (let i = 0; i < 20; i++) widths.add(computeMaskWidth('p', i, 8))
    // Expect at least 2 distinct jittered values across 20 different indices
    expect(widths.size).toBeGreaterThan(1)
  })

  it('enforces the 1.4em floor for very short words (before jitter)', () => {
    // tokenLength 1 or 2: base = max(1.4, length × 0.55) = 1.4;
    // output = 1.4 × (1 ± 0.10) → [1.26, 1.54]
    for (let idx = 0; idx < 20; idx++) {
      const w1 = computeMaskWidth('p', idx, 1)
      const w2 = computeMaskWidth('p', idx, 2)
      expect(w1).toBeGreaterThanOrEqual(1.4 * 0.9 - 1e-9)
      expect(w1).toBeLessThanOrEqual(1.4 * 1.1 + 1e-9)
      expect(w2).toBeGreaterThanOrEqual(1.4 * 0.9 - 1e-9)
      expect(w2).toBeLessThanOrEqual(1.4 * 1.1 + 1e-9)
    }
  })

  it('is server-safe (no browser-global references at import time)', () => {
    expect(() => computeMaskWidth('ssr-page', 0, 5)).not.toThrow()
  })
})
