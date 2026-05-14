/**
 * Phase 22 — Hash-set self-check + re-inlining tripwire (HASH-PARITY-TEST).
 *
 * Originally Phase 21-03's 3-way parity test (after Phase 20-CR-02 caught a real
 * drift where ranked/start was missing the title-tokens loop). Phase 22 consolidated
 * both route inline blocks into the single exported helper:
 *
 *   - lib/client-hash.ts:computeWordHashSet()  — single source of truth
 *   - app/api/game/today/route.ts              — calls the helper (no inline loop)
 *   - app/api/ranked/start/route.ts            — calls the helper (no inline loop)
 *
 * Per Phase 22 D-04, the structural-copy helpers below (`buildHashSet*Inline`) are
 * KEPT verbatim as regression guards. They are now SNAPSHOTS of the historical
 * pre-consolidation inline code rather than mirrors of live route code. The test
 * remains green because the helper output matches the snapshots; if a future phase
 * re-inlines either route with a typo, this test fails loudly.
 *
 * Companion guard: `no-inline-hash-loops.test.ts` (Phase 22 Plan 05 Task 2) scans
 * the live route files for inline hash-loop signatures and asserts zero matches —
 * the load-bearing SC-1 enforcement that survives even if these structural copies
 * are eventually deleted.
 *
 * Note: if Phase 22 Plan 04 modified the structural-copy title-token loops to
 * incorporate the D-01 symmetry fix (cleaned title-token normalization), those
 * structural copies were updated accordingly and this comment reflects that state.
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { computeWordHashSet, variantsOf } from './client-hash'
import { normalize, cleanTokenValue } from './matching'

function sha256hex16(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16)
}

type BodyToken = { type: string; value: string; isStopword?: boolean }
type TitleToken = { isWord: boolean; isStopword?: boolean; value: string }

/** Structural copy of app/api/game/today/route.ts lines 99–123. */
function buildHashSetTodayInline(tokens: BodyToken[], titleTokens: TitleToken[]): string[] {
  const wordHashSet: string[] = []
  const seenHashes = new Set<string>()
  for (const token of tokens) {
    if (token.type !== 'word' || token.isStopword) continue
    const norm = normalize(cleanTokenValue(token.value))
    for (const variant of variantsOf(norm)) {
      const hash = createHash('sha256').update(variant).digest('hex').slice(0, 16)
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash)
        wordHashSet.push(hash)
      }
    }
  }
  for (const tw of titleTokens) {
    if (!tw.isWord || tw.isStopword) continue
    const norm = normalize(tw.value)
    for (const variant of variantsOf(norm)) {
      const hash = createHash('sha256').update(variant).digest('hex').slice(0, 16)
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash)
        wordHashSet.push(hash)
      }
    }
  }
  return wordHashSet
}

/** Structural copy of app/api/ranked/start/route.ts lines 142–168.
 *
 * NOTE: the ranked route's inline regex MUST include `œŒ` to match the other
 * two paths. If it doesn't, the parity assertions below will fail for tokens
 * containing U+0152/U+0153 — exactly the drift this test is designed to catch.
 */
function buildHashSetRankedInline(tokens: BodyToken[], titleTokens: TitleToken[]): string[] {
  const wordHashSet: string[] = []
  const seenHashes = new Set<string>()
  for (const token of tokens) {
    if (token.type !== 'word' || token.isStopword) continue
    // Ranked/start uses inline .replace() rather than the cleanTokenValue() import.
    // Class must match cleanTokenValue and computeWordHashSet (includes œŒ).
    const norm = normalize(token.value.replace(/[^a-zA-ZÀ-ÿœŒ0-9'-]/g, ''))
    for (const variant of variantsOf(norm)) {
      const hash = createHash('sha256').update(variant).digest('hex').slice(0, 16)
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash)
        wordHashSet.push(hash)
      }
    }
  }
  for (const tw of titleTokens) {
    if (!tw.isWord || tw.isStopword) continue
    const norm = normalize(tw.value)
    for (const variant of variantsOf(norm)) {
      const hash = createHash('sha256').update(variant).digest('hex').slice(0, 16)
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash)
        wordHashSet.push(hash)
      }
    }
  }
  return wordHashSet
}

describe('Phase 21-03: hash-set 3-way parity (MORPH-FR-HASH)', () => {
  // FR-focused fixture: each token exercises a Phase 21 rule.
  // Tokens deliberately use only [a-zA-ZÀ-ÿœŒ] characters so the cleaning regex
  // is a no-op on these inputs — keeps the 3 paths byte-equivalent.
  const tokens: BodyToken[] = [
    { type: 'word', value: 'cheval',  isStopword: false }, // 21-01 -al/-aux
    { type: 'word', value: 'journal', isStopword: false }, // 21-01 -al/-aux
    { type: 'word', value: 'genou',   isStopword: false }, // 21-01 -ou exception
    { type: 'word', value: 'œil',     isStopword: false }, // 21-01 vowel-change
    { type: 'word', value: 'ciel',    isStopword: false }, // 21-01 vowel-change
    { type: 'word', value: 'finir',   isStopword: false }, // 21-02 -ir/-i
    { type: 'word', value: 'vendre',  isStopword: false }, // 21-02 -re/-u
    { type: 'word', value: 'prendre', isStopword: false }, // 21-02 irregular pris
    { type: 'word', value: 'être',    isStopword: false }, // 21-02 irregular class
    { type: 'word', value: 'avoir',   isStopword: false }, // 21-02 irregular class
    { type: 'word', value: 'le',      isStopword: true  }, // stopword — must NOT hash
  ]

  const titleTokens: TitleToken[] = [
    { isWord: true,  isStopword: false, value: 'manger' },  // Phase 20-01 -er rule
    { isWord: true,  isStopword: false, value: 'animal' },  // Phase 21-01 -al/-aux in title
    { isWord: false, isStopword: false, value: ' '       }, // non-word — must NOT hash
    { isWord: true,  isStopword: true,  value: 'la'      }, // stopword — must NOT hash
  ]

  const fromCompute = computeWordHashSet(tokens, titleTokens)
  const fromTodayInline = buildHashSetTodayInline(tokens, titleTokens)
  const fromRankedInline = buildHashSetRankedInline(tokens, titleTokens)

  it('computeWordHashSet === today inline (order-insensitive)', () => {
    expect([...fromCompute].sort()).toEqual([...fromTodayInline].sort())
  })

  it('computeWordHashSet === ranked inline (order-insensitive)', () => {
    expect([...fromCompute].sort()).toEqual([...fromRankedInline].sort())
  })

  it('today inline === ranked inline (transitivity guard)', () => {
    expect([...fromTodayInline].sort()).toEqual([...fromRankedInline].sort())
  })

  it('contains hash for FR -al/-aux variant (chevaux)', () => {
    expect(fromCompute).toContain(sha256hex16('chevaux'))
  })

  it('contains hash for FR -ou exception variant (genoux)', () => {
    expect(fromCompute).toContain(sha256hex16('genoux'))
  })

  it('contains hash for FR vowel-change variant (yeux from œil token)', () => {
    expect(fromCompute).toContain(sha256hex16('yeux'))
  })

  it('contains hash for FR vowel-change variant (cieux from ciel token)', () => {
    expect(fromCompute).toContain(sha256hex16('cieux'))
  })

  it('contains hash for FR -ir/-i variant (fini from finir token)', () => {
    expect(fromCompute).toContain(sha256hex16('fini'))
  })

  it('contains hash for FR -re/-u variant (vendu from vendre token)', () => {
    expect(fromCompute).toContain(sha256hex16('vendu'))
  })

  it('contains hash for FR irregular pris from prendre token', () => {
    expect(fromCompute).toContain(sha256hex16('pris'))
  })

  it('contains hash for FR irregular class être (est, ete, etant, etait from être token)', () => {
    // normalize('être') === 'etre'; class members normalize accordingly.
    expect(fromCompute).toContain(sha256hex16('est'))
    expect(fromCompute).toContain(sha256hex16('ete'))
    expect(fromCompute).toContain(sha256hex16('etant'))
    expect(fromCompute).toContain(sha256hex16('etait'))
  })

  it('contains hash for FR irregular class avoir (a, eu, ayant, avait from avoir token)', () => {
    expect(fromCompute).toContain(sha256hex16('a'))
    expect(fromCompute).toContain(sha256hex16('eu'))
    expect(fromCompute).toContain(sha256hex16('ayant'))
    expect(fromCompute).toContain(sha256hex16('avait'))
  })

  it('contains hash for Phase 20-01 regression (mangé normalized to mange from manger title token)', () => {
    expect(fromCompute).toContain(sha256hex16('mange'))
  })

  it('does NOT contain hashes for stopword body token (le)', () => {
    expect(fromCompute).not.toContain(sha256hex16('le'))
  })

  it('does NOT contain hashes for stopword title token (la)', () => {
    expect(fromCompute).not.toContain(sha256hex16('la'))
  })

  it('does NOT contain hashes for non-word title token (space)', () => {
    expect(fromCompute).not.toContain(sha256hex16(' '))
    expect(fromCompute).not.toContain(sha256hex16(''))
  })

  it('parity holds with empty inputs', () => {
    const a = computeWordHashSet([], [])
    const b = buildHashSetTodayInline([], [])
    const c = buildHashSetRankedInline([], [])
    expect(a).toEqual([])
    expect(b).toEqual([])
    expect(c).toEqual([])
  })

  it('parity holds with title-only input (no body tokens)', () => {
    const a = computeWordHashSet([], titleTokens)
    const b = buildHashSetTodayInline([], titleTokens)
    const c = buildHashSetRankedInline([], titleTokens)
    expect([...a].sort()).toEqual([...b].sort())
    expect([...a].sort()).toEqual([...c].sort())
  })
})
