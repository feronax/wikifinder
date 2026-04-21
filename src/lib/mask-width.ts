/**
 * Deterministic mask width, proportional to word length.
 *
 * Per design-proto mask.jsx:17 (source of truth, supersedes prior D-05 PRNG
 * jitter decision from 2026-04-19):
 *   const w = Math.max(1.4, word.length * 0.56)
 *
 * Width mimics the actual word length — no jitter, no seeded randomness.
 * Hydration-safe because output is a pure function of tokenLength; pageId
 * and tokenIndex are retained in the signature for call-site stability.
 *
 * Pure function; no browser globals. Safe in Node (SSR, Vitest) and browser.
 */
export function computeMaskWidth(
  pageId: string,
  tokenIndex: number,
  tokenLength: number
): number {
  void pageId
  void tokenIndex
  // Base: length × 0.56em, floor 1.4em (proto mask.jsx:17)
  return +Math.max(1.4, tokenLength * 0.56).toFixed(3)
}
