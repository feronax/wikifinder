import { normalize, frIrregularVerbs } from './matching'
import { createHash } from 'crypto'

let hashSetCache: Set<string> | null = null

/**
 * Generate all morphological variant forms of a normalized word that
 * wordsMatch() would accept. Must stay in sync with the rules in matching.ts.
 * Called during hash set construction so the client's O(1) hash lookup
 * covers all valid inflected forms of each article token.
 */
export function variantsOf(norm: string): string[] {
  const variants: string[] = [norm]

  // EN irregular plurals — f/fe → ves
  if (norm.endsWith('ves')) {
    variants.push(norm.slice(0, -3) + 'fe')
    variants.push(norm.slice(0, -3) + 'f')
  }
  if (norm.endsWith('fe')) variants.push(norm.slice(0, -2) + 'ves')
  if (norm.endsWith('f') && !norm.endsWith('ff')) variants.push(norm.slice(0, -1) + 'ves')

  // EN irregular plurals — men → man
  if (norm.endsWith('men')) variants.push(norm.slice(0, -3) + 'man')
  if (norm.endsWith('man')) variants.push(norm.slice(0, -3) + 'men')

  // EN irregular plurals — explicit vowel-change pairs
  const irregularPairs: [string, string][] = [
    ['child', 'children'], ['tooth', 'teeth'], ['foot', 'feet'],
    ['mouse', 'mice'], ['goose', 'geese'],
  ]
  for (const [a, b] of irregularPairs) {
    if (norm === a) variants.push(b)
    if (norm === b) variants.push(a)
  }

  // ===== Phase 21-01: FR irregular plurals =====
  // FR -al → -aux plural rule. Naive emission may over-generate for -al
  // exceptions (bal→baux is not a real word), but extra hashes in the set
  // are harmless: only real player guesses get looked up, and 'baux' is a
  // real word anyway (bail/baux is a distinct lemma). Documented in plan.
  if (norm.endsWith('al') && norm.length > 3) variants.push(norm.slice(0, -2) + 'aux')
  if (norm.endsWith('aux') && norm.length > 4) variants.push(norm.slice(0, -3) + 'al')

  // FR -ou exception list — mirrors matching.ts:frIrregularPluralPairs.
  // variantsOf has no generic +x emission, so these must be enumerated.
  const frOuPairs: [string, string][] = [
    ['genou', 'genoux'], ['caillou', 'cailloux'], ['hibou', 'hiboux'],
    ['bijou', 'bijoux'], ['chou', 'choux'], ['joujou', 'joujoux'], ['pou', 'poux'],
  ]
  for (const [base, plural] of frOuPairs) {
    if (norm === base) variants.push(plural)
    if (norm === plural) variants.push(base)
  }

  // FR travail/travaux — generic -al/-aux above misses this one (slice
  // drops 3 not 4). Explicit pair mirrors matching.ts.
  if (norm === 'travail') variants.push('travaux')
  if (norm === 'travaux') variants.push('travail')

  // FR vowel-change pairs (œil/yeux, oeil/yeux, ciel/cieux). NFD does NOT
  // decompose U+0153 (œ), so we list both 'œil' and 'oeil' to handle either
  // input spelling. When the seed is 'yeux' we emit BOTH 'œil' and 'oeil'.
  const frVowelChangePairs: [string, string][] = [
    ['œil', 'yeux'], ['oeil', 'yeux'], ['ciel', 'cieux'],
  ]
  for (const [base, plural] of frVowelChangePairs) {
    if (norm === base) variants.push(plural)
    if (norm === plural) {
      variants.push(base)
      // yeux → both 'œil' and 'oeil' (both spellings reachable from same plural)
      if (base === 'œil') variants.push('oeil')
      if (base === 'oeil') variants.push('œil')
    }
  }

  // ===== Phase 21-02: FR verb inflection beyond -er =====
  // Named-irregular equivalence-class emission: mirrors matching.ts:frIrregularLookup.
  // The frIrregularVerbs array is the shared source of truth (imported above);
  // the Map is rebuilt here lazily to avoid coupling private state across files.
  const irrClass = lazyFrIrregularLookup().get(norm)
  if (irrClass) {
    for (const other of irrClass) variants.push(other)
  }

  // FR -re → -u (regular). Guard: skip if `norm` is an irregular -re infinitive
  // (those are emitted via the lookup above, so 'prendre' does NOT emit 'prendu').
  const irrReInfs = lazyFrIrregularReInfinitives()
  if (norm.endsWith('re') && norm.length > 3 && !irrReInfs.has(norm)) {
    variants.push(norm.slice(0, -2) + 'u')
  }
  // Reverse direction (vendu → vendre). Emitting `slice(0,-1) + 're'` for any norm
  // ending in 'u' is harmless over-emission — server wordsMatch remains source of
  // truth for guess validation, so extra hashes never produce false matches.
  if (norm.endsWith('u') && norm.length > 3) {
    variants.push(norm.slice(0, -1) + 're')
  }

  // EN verb inflection — +ing simple (independent ifs prevent over-generation for
  // short words like "ring" → "ringing" from the previous if/else structure)
  if (norm.endsWith('ing') && norm.length > 4) variants.push(norm.slice(0, -3))
  if (!norm.endsWith('ing')) variants.push(norm + 'ing')

  // EN verb inflection — +ed simple
  if (norm.endsWith('ed') && norm.length > 3) variants.push(norm.slice(0, -2))
  if (!norm.endsWith('ed')) variants.push(norm + 'ed')

  // EN verb inflection — e-drop +ing (loving → love, love → loving)
  if (norm.endsWith('ing') && norm.length > 4) variants.push(norm.slice(0, -3) + 'e')
  if (norm.endsWith('e')) variants.push(norm.slice(0, -1) + 'ing')

  // EN verb inflection — e-drop +d (loved → love, love → loved)
  if (norm.endsWith('d') && !norm.endsWith('ed') && norm.slice(0, -1).endsWith('e')) variants.push(norm.slice(0, -1))
  if (norm.endsWith('e')) variants.push(norm + 'd')

  // EN verb inflection — explicit stem-doubling pairs
  const doublingStemPairs: [string, string][] = [
    ['run', 'running'], ['get', 'getting'], ['hit', 'hitting'],
    ['sit', 'sitting'], ['swim', 'swimming'], ['begin', 'beginning'],
    ['put', 'putting'], ['cut', 'cutting'], ['set', 'setting'],
  ]
  for (const [base, inflected] of doublingStemPairs) {
    if (norm === base) variants.push(inflected)
    if (norm === inflected) variants.push(base)
  }

  // FR verb inflection — -er infinitive ↔ past participle (normalized)
  // normalize('mangé') = 'mange', normalize('manger') = 'manger'
  // Length guard > 3 prevents single/double-char words from generating spurious
  // variants (e.g. "a" → "ar", "or" → "o") that cause false-positive hash hits.
  if (norm.endsWith('r') && norm.length > 3) variants.push(norm.slice(0, -1))
  if (!norm.endsWith('r') && norm.length > 3) variants.push(norm + 'r')

  return [...new Set(variants)]
}

// Lazy lookups for Phase 21-02 FR named-irregular verbs. Built once on first call,
// then cached at module scope. Equivalent to matching.ts:frIrregularLookup but
// duplicated here to avoid exporting a private Map across the matching ↔ client-hash
// boundary. The underlying frIrregularVerbs array IS the shared source of truth.
let _frIrregularLookup: Map<string, Set<string>> | null = null
function lazyFrIrregularLookup(): Map<string, Set<string>> {
  if (_frIrregularLookup) return _frIrregularLookup
  const m = new Map<string, Set<string>>()
  for (const row of frIrregularVerbs) {
    const normRow = row.map(f => normalize(f))
    for (const form of normRow) {
      const existing = m.get(form) ?? new Set<string>()
      for (const other of normRow) {
        if (other !== form) existing.add(other)
      }
      m.set(form, existing)
    }
  }
  _frIrregularLookup = m
  return m
}

let _frIrregularReInfinitives: Set<string> | null = null
function lazyFrIrregularReInfinitives(): Set<string> {
  if (_frIrregularReInfinitives) return _frIrregularReInfinitives
  _frIrregularReInfinitives = new Set(
    frIrregularVerbs
      .map(row => normalize(row[0]))
      .filter(inf => inf.endsWith('re'))
  )
  return _frIrregularReInfinitives
}

export function setWordHashSet(hashes: string[]) {
  hashSetCache = new Set(hashes)
}

export async function isWordInArticle(word: string): Promise<boolean> {
  if (!hashSetCache) return false
  const norm = normalize(word)
  const hash = await sha256Truncated(norm)
  return hashSetCache.has(hash)
}

async function sha256Truncated(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

// Phase 3 Plan 03: server-side pre-compute of the wordHashSet sent to clients for
// instant local verification. Called from /api/survival/start (and later
// consolidates the inline blocks in /api/game/today + /api/ranked/start — out of
// scope here to keep Phase 2.1 regression posture). Kept in client-hash.ts so the
// hash algorithm is co-located with the client-side `sha256Truncated` consumer —
// single source of truth for the SHA-256 truncated-to-16-hex contract.
//
// Byte-identical to the inline block in ranked/start/route.ts:142-152 and
// game/today/route.ts:93-113 (verified 2026-04-18).
export function computeWordHashSet(
  tokens: Array<{ type: string; value: string; isStopword?: boolean }>,
  titleTokens: Array<{ isWord: boolean; isStopword?: boolean; value: string }>
): string[] {
  const wordHashSet: string[] = []
  const seenHashes = new Set<string>()
  for (const token of tokens) {
    if (token.type !== 'word' || token.isStopword) continue
    // Same cleaning regex as matching.ts:cleanTokenValue — includes œŒ (U+0152/3)
    // outside À-ÿ so the o-e ligature survives for FR words like 'œil', 'cœur'.
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
