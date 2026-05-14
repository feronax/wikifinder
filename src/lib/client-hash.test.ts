import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { computeWordHashSet, variantsOf } from './client-hash'
import { normalize } from './matching'

function sha256hex16(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16)
}

describe('variantsOf', () => {
  it('includes base form', () => {
    expect(variantsOf('run')).toContain('run')
  })
  it('includes +ing stem-doubling variant (run → running)', () => {
    expect(variantsOf('run')).toContain('running')
  })
  it('includes reverse (running → run)', () => {
    expect(variantsOf('running')).toContain('run')
  })
  it('includes f→ves variant (knife → knives)', () => {
    expect(variantsOf('knife')).toContain('knives')
  })
  it('includes reverse (knives → knife)', () => {
    expect(variantsOf('knives')).toContain('knife')
  })
  it('includes +ing simple (walk → walking)', () => {
    expect(variantsOf('walk')).toContain('walking')
  })
  it('includes +ed simple (walk → walked)', () => {
    expect(variantsOf('walk')).toContain('walked')
  })
  it('includes FR -er pp normalized (manger → mange)', () => {
    // normalize('mangé') = 'mange'; infinitive 'manger' → variant 'mange'
    expect(variantsOf('manger')).toContain('mange')
  })
  it('deduplicates (no repeated entries)', () => {
    const v = variantsOf('run')
    expect(v.length).toBe(new Set(v).size)
  })

  // ===== Phase 21-01: FR irregular plurals =====
  it('includes FR -al/-aux variant (cheval → chevaux)', () => {
    expect(variantsOf('cheval')).toContain('chevaux')
  })
  it('includes reverse (chevaux → cheval)', () => {
    expect(variantsOf('chevaux')).toContain('cheval')
  })
  it('includes FR -al/-aux variant (journal → journaux)', () => {
    expect(variantsOf('journal')).toContain('journaux')
  })
  it('includes FR -al/-aux variant (travail → travaux)', () => {
    expect(variantsOf('travail')).toContain('travaux')
  })
  it('includes FR -ou exception variant (genou → genoux)', () => {
    expect(variantsOf('genou')).toContain('genoux')
  })
  it('includes FR -ou reverse (genoux → genou)', () => {
    expect(variantsOf('genoux')).toContain('genou')
  })
  it('includes FR vowel-change variant (œil → yeux)', () => {
    expect(variantsOf('œil')).toContain('yeux')
  })
  it('includes FR vowel-change reverse with oe fallback (yeux → oeil)', () => {
    expect(variantsOf('yeux')).toContain('oeil')
  })
  it('includes FR vowel-change variant (ciel → cieux)', () => {
    expect(variantsOf('ciel')).toContain('cieux')
  })
  it('FR plural variants deduplicate', () => {
    const v = variantsOf('cheval')
    expect(v.length).toBe(new Set(v).size)
  })

  // ===== Phase 21-02: FR verb inflection beyond -er =====
  it('includes FR -ir/-i variant (finir → fini)', () => {
    expect(variantsOf('finir')).toContain('fini')
  })
  it('includes FR -ir/-i reverse (fini → finir)', () => {
    expect(variantsOf('fini')).toContain('finir')
  })
  it('includes FR -re/-u variant (vendre → vendu)', () => {
    expect(variantsOf('vendre')).toContain('vendu')
  })
  it('includes FR -re/-u reverse (vendu → vendre)', () => {
    expect(variantsOf('vendu')).toContain('vendre')
  })
  it('includes FR irregular pris from prendre (NOT prendu)', () => {
    const v = variantsOf('prendre')
    expect(v).toContain('pris')
    expect(v).not.toContain('prendu')
  })
  it('includes FR irregular equivalence class être (etre → ete, etant, est, etait)', () => {
    const v = variantsOf('etre')
    expect(v).toContain('ete')
    expect(v).toContain('etant')
    expect(v).toContain('est')
    expect(v).toContain('etait')
  })
  it('includes FR irregular reverse (est → etre)', () => {
    expect(variantsOf('est')).toContain('etre')
  })
  it('includes FR irregular avoir class (a → avoir, eu, ayant, avait)', () => {
    const v = variantsOf('a')
    expect(v).toContain('avoir')
    expect(v).toContain('eu')
    expect(v).toContain('ayant')
    expect(v).toContain('avait')
  })
  it('FR verb variants deduplicate', () => {
    const v = variantsOf('etre')
    expect(v.length).toBe(new Set(v).size)
  })
})

describe('computeWordHashSet — variant hash coverage (HASH-SYNC)', () => {
  const tokens = [
    { type: 'word', value: 'run', isStopword: false },
    { type: 'word', value: 'knife', isStopword: false },
    { type: 'word', value: 'manger', isStopword: false },
    { type: 'word', value: 'walk', isStopword: false },
  ]

  it('contains hash of base form', () => {
    const hashSet = computeWordHashSet(tokens, [])
    expect(hashSet).toContain(sha256hex16('run'))
  })

  it('contains hash of stem-doubling variant (running)', () => {
    const hashSet = computeWordHashSet(tokens, [])
    expect(hashSet).toContain(sha256hex16('running'))
  })

  it('contains hash of f→ves variant (knives)', () => {
    const hashSet = computeWordHashSet(tokens, [])
    expect(hashSet).toContain(sha256hex16('knives'))
  })

  it('contains hash of FR -er pp normalized (mange)', () => {
    const hashSet = computeWordHashSet(tokens, [])
    expect(hashSet).toContain(sha256hex16('mange'))
  })

  it('contains hash of +ing simple variant (walking)', () => {
    const hashSet = computeWordHashSet(tokens, [])
    expect(hashSet).toContain(sha256hex16('walking'))
  })

  it('contains hash of +ed simple variant (walked)', () => {
    const hashSet = computeWordHashSet(tokens, [])
    expect(hashSet).toContain(sha256hex16('walked'))
  })

  it('does not contain hashes for stopword tokens', () => {
    const withStopword = [...tokens, { type: 'word', value: 'le', isStopword: true }]
    const hashSet = computeWordHashSet(withStopword, [])
    expect(hashSet).not.toContain(sha256hex16('le'))
  })

  // ===== Phase 21-01: FR irregular plurals =====
  it('contains hash of FR -al/-aux variant (chevaux)', () => {
    const frTokens = [{ type: 'word', value: 'cheval', isStopword: false }]
    const hashSet = computeWordHashSet(frTokens, [])
    expect(hashSet).toContain(sha256hex16('chevaux'))
  })

  it('contains hash of FR vowel-change variant (yeux from oeil token)', () => {
    // Exercises the de-ligatured 'oeil' form. The literal 'œil' case is
    // covered separately below; both forms now hash correctly thanks to the
    // widened cleaning regex (œŒ added to the character class).
    const frTokens = [{ type: 'word', value: 'oeil', isStopword: false }]
    const hashSet = computeWordHashSet(frTokens, [])
    expect(hashSet).toContain(sha256hex16('yeux'))
  })

  it('contains hash of FR -ou exception variant (genoux from genou token)', () => {
    const frTokens = [{ type: 'word', value: 'genou', isStopword: false }]
    const hashSet = computeWordHashSet(frTokens, [])
    expect(hashSet).toContain(sha256hex16('genoux'))
  })

  // ===== Phase 21-02: FR verb inflection beyond -er =====
  it('contains hash of FR -ir/-i variant (fini from finir token)', () => {
    const frTokens = [{ type: 'word', value: 'finir', isStopword: false }]
    const hashSet = computeWordHashSet(frTokens, [])
    expect(hashSet).toContain(sha256hex16('fini'))
  })

  it('contains hash of FR -re/-u variant (vendu from vendre token)', () => {
    const frTokens = [{ type: 'word', value: 'vendre', isStopword: false }]
    const hashSet = computeWordHashSet(frTokens, [])
    expect(hashSet).toContain(sha256hex16('vendu'))
  })

  it('contains hash of FR irregular pris from prendre token', () => {
    const frTokens = [{ type: 'word', value: 'prendre', isStopword: false }]
    const hashSet = computeWordHashSet(frTokens, [])
    expect(hashSet).toContain(sha256hex16('pris'))
  })

  it('contains hash of FR irregular est from être token', () => {
    const frTokens = [{ type: 'word', value: 'être', isStopword: false }]
    const hashSet = computeWordHashSet(frTokens, [])
    expect(hashSet).toContain(sha256hex16('est'))
  })

  it('contains hash of FR irregular été from être token (normalized to ete)', () => {
    const frTokens = [{ type: 'word', value: 'être', isStopword: false }]
    const hashSet = computeWordHashSet(frTokens, [])
    expect(hashSet).toContain(sha256hex16('ete'))
  })

  it("contains hash of yeux when the article token is literal 'œil' (U+0153)", () => {
    // Locks the fix for the pre-existing cleanTokenValue regex bug flagged in
    // Phase 21-01 SUMMARY: the cleaning regex [^a-zA-ZÀ-ÿ0-9'-] used to strip
    // œ (U+0153 is outside À-ÿ which ends at U+00FF), so 'œil' became 'il'
    // before normalize/variantsOf ever saw it. After widening the class to
    // include œŒ, the U+0153 ligature survives cleaning and the pair table
    // entry `['œil', 'yeux']` produces the expected variant hash.
    const frTokens = [{ type: 'word', value: 'œil', isStopword: false }]
    const hashSet = computeWordHashSet(frTokens, [])
    expect(hashSet).toContain(sha256hex16('yeux'))
  })
})

describe('Phase 22 — title-token symmetry (D-01)', () => {
  it('applies cleanTokenValue regex symmetrically to title tokens', () => {
    // Title token with a character outside [a-zA-ZÀ-ÿœŒ0-9'-]
    const titleTokens = [{ isWord: true, isStopword: false, value: 'foo!' }]
    const cleaned = normalize('foo')

    const hashes = computeWordHashSet([], titleTokens)

    // Build the expected hash set of the CLEANED value across all variants
    const expectedHashes = variantsOf(cleaned).map(v =>
      createHash('sha256').update(v).digest('hex').slice(0, 16)
    )

    for (const h of expectedHashes) {
      expect(hashes).toContain(h)
    }
  })
})
