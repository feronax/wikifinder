/**
 * Phase 22 — Hash-set snapshot parity (HASH-PARITY-TEST, SC-3).
 *
 * Pins computeWordHashSet output for real production page tokens (one daily-page
 * row, FR + EN). The fixture is the pre-consolidation baseline:
 *   - After Plan 02-03 (route consolidation): MUST stay GREEN (byte-identical body
 *     and title cleaning).
 *   - After Plan 04 (title-token symmetry fix): expected to stay GREEN per
 *     RESEARCH near-zero blast radius — title tokens already lack stripped chars
 *     post-tokenizeTitle. If it shifts, update fixture with documented justification.
 */
import { describe, it, expect } from 'vitest'
import fixture from './__fixtures__/page-tokens-snapshot.json'
import { computeWordHashSet } from './client-hash'

describe('Phase 22: hash-set snapshot parity (HASH-PARITY-TEST)', () => {
  for (const lang of ['fr', 'en'] as const) {
    it(`${lang}: hash array stable for production page tokens`, () => {
      const { tokens, titleTokens, expectedHashArray } = fixture[lang]
      const actual = computeWordHashSet(tokens as any, titleTokens as any)
      expect(actual.slice().sort()).toEqual(expectedHashArray.slice().sort())
    })
  }
})
