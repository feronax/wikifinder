import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { computeWordHashSet, variantsOf } from './client-hash'

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
})
