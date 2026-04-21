/**
 * Seeded deterministic mask width.
 * Same (pageId, tokenIndex) → same output on SSR + hydrate + every re-render.
 * Zero hydration mismatch (D-04).
 *
 * Pure function; no browser globals, no imports. Safe to evaluate in Node
 * (SSR, Vitest) and in the browser (client hydration, re-renders).
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

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function computeMaskWidth(
  pageId: string,
  tokenIndex: number,
  tokenLength: number
): number {
  const seed = xmur3(`${pageId}:${tokenIndex}`)()
  const rand = mulberry32(seed)()
  // Base: length × 0.56em (from mask.jsx / proto comment)
  // Jitter: ±35% (range 0.65× .. 1.35× per D-05)
  const base = Math.max(1.4, tokenLength * 0.56)
  const jitter = 0.65 + rand * 0.7   // 0.65..1.35 range per D-05
  return +(base * jitter).toFixed(3)
}
