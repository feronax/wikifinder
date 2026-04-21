import { describe, it, expect } from 'vitest'
import { computeMaskWidth } from './mask-width'

describe('computeMaskWidth', () => {
  it('is deterministic for the same inputs', () => {
    const first = computeMaskWidth('page-x', 5, 7)
    for (let i = 0; i < 100; i++) {
      expect(computeMaskWidth('page-x', 5, 7)).toBe(first)
    }
  })

  it('is proportional to token length (no jitter, matches proto mask.jsx:17)', () => {
    // Width = max(1.4, length × 0.56) per design-proto mask.jsx
    expect(computeMaskWidth('p', 0, 2)).toBe(1.4) // 2 * 0.56 = 1.12 → floor 1.4
    expect(computeMaskWidth('p', 0, 3)).toBe(1.68) // 3 * 0.56
    expect(computeMaskWidth('p', 0, 8)).toBe(4.48) // 8 * 0.56
    expect(computeMaskWidth('p', 0, 12)).toBe(6.72)
    // Monotonic above the floor: longer words → wider masks
    expect(computeMaskWidth('p', 0, 8)).toBeGreaterThan(computeMaskWidth('p', 0, 3))
  })

  it('ignores pageId and tokenIndex (same length → same width everywhere)', () => {
    const w = computeMaskWidth('page-a', 5, 7)
    expect(computeMaskWidth('page-b', 99, 7)).toBe(w)
    expect(computeMaskWidth('different-page', 0, 7)).toBe(w)
  })

  it('enforces the 1.4em floor for very short words', () => {
    // 1 * 0.56 = 0.56 → floored to 1.4
    expect(computeMaskWidth('p', 0, 1)).toBe(1.4)
    // 2 * 0.56 = 1.12 → floored to 1.4
    expect(computeMaskWidth('p', 0, 2)).toBe(1.4)
  })

  it('is server-safe (no browser-global references at import time)', () => {
    // Vitest default env is node — window/document/localStorage are undefined.
    // If the module accessed any, it would have thrown at import. Sanity-call
    // the export to ensure runtime path is also globals-free.
    expect(() => computeMaskWidth('ssr-page', 0, 5)).not.toThrow()
  })
})
