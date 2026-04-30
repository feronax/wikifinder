/**
 * Deterministic mask width, proportional to word length with ±10% jitter.
 *
 * Per design/DESIGN-HANDOFF.md §3 (authoritative):
 *   width ≈ nb chars × 0.55em, ±10% jitter via seeded hash (handoff line 185)
 *
 * Seeded PRNG (xmur3 → jitter in [-0.10, +0.10]) keyed on `${pageId}:${tokenIndex}`
 * so the same (pageId, tokenIndex) always produces identical output across
 * SSR + hydrate + re-renders (zero hydration mismatch).
 *
 * Pure function; no browser globals. Safe in Node (SSR, Vitest) and browser.
 */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

export function computeMaskWidth(
  pageId: string,
  tokenIndex: number,
  tokenLength: number
): number {
  const seed = xmur3(`${pageId}:${tokenIndex}`)()
  // Map seed → jitter in [-0.10, +0.10] (handoff §3)
  const jitter = ((seed % 20) - 10) / 100
  const base = Math.max(1.4, tokenLength * 0.55)
  return +(base * (1 + jitter)).toFixed(3)
}
