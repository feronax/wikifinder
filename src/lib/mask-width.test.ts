import { describe, it, expect } from 'vitest'
import { computeMaskWidth } from './mask-width'

describe('computeMaskWidth', () => {
  it('is deterministic for the same inputs', () => {
    const first = computeMaskWidth('page-x', 5, 7)
    for (let i = 0; i < 100; i++) {
      expect(computeMaskWidth('page-x', 5, 7)).toBe(first)
    }
  })

  it('varies across tokenIndex within the same page', () => {
    const widths = new Set<number>()
    for (let i = 0; i < 50; i++) {
      widths.add(computeMaskWidth('page-x', i, 7))
    }
    expect(widths.size).toBeGreaterThan(20)
  })

  it('varies across pageId at the same tokenIndex', () => {
    const pageIds = ['page-a', 'page-b', 'page-c', 'page-d', 'page-e',
      'page-f', 'page-g', 'page-h', 'page-i', 'page-j']
    const widths = new Set<number>()
    for (const pid of pageIds) {
      widths.add(computeMaskWidth(pid, 5, 7))
    }
    expect(widths.size).toBeGreaterThanOrEqual(9)
  })

  it('respects bounds 0.65×..1.35× of Math.max(1.4, length×0.56)', () => {
    const tol = 1e-9
    let violations = 0
    for (let length = 1; length <= 15; length++) {
      const base = Math.max(1.4, length * 0.56)
      for (let idx = 0; idx <= 200; idx++) {
        const w = computeMaskWidth('bounds-page', idx, length)
        const ratio = w / base
        if (ratio < 0.65 - tol || ratio > 1.35 + tol) {
          violations++
        }
      }
    }
    expect(violations).toBe(0)
  })

  it('is server-safe (no browser-global references at import time)', () => {
    // Vitest default env is node — window/document/localStorage are undefined.
    // If the module accessed any, it would have thrown at import. Sanity-call
    // the export to ensure runtime path is also globals-free.
    expect(() => computeMaskWidth('ssr-page', 0, 5)).not.toThrow()
  })
})
