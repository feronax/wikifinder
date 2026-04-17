import { describe, it, expect } from 'vitest'
import {
  tokenizeContent,
  tokenizeTitle,
  maskTokensForClient,
  maskTitleForClient,
} from '@/lib/tokenize'

describe('tokenizeContent', () => {
  it('splits body into word/space/punct tokens (fr)', () => {
    const tokens = tokenizeContent('Le chat dort.', 'fr')
    // ContentToken[] exposes .type — this is correct for tokenizeContent results
    const words = tokens.filter(t => t.type === 'word')
    expect(words).toHaveLength(3)
    expect(words.map(w => w.value)).toEqual(['Le', 'chat', 'dort'])
  })
  it('marks FR stopwords', () => {
    const tokens = tokenizeContent('Le chat', 'fr')
    const le = tokens.find(t => t.value === 'Le')
    const chat = tokens.find(t => t.value === 'chat')
    expect(le?.isStopword).toBe(true)
    expect(chat?.isStopword).toBe(false)
  })
  it('marks EN stopwords', () => {
    const tokens = tokenizeContent('The cat', 'en')
    const the = tokens.find(t => t.value === 'The')
    const cat = tokens.find(t => t.value === 'cat')
    expect(the?.isStopword).toBe(true)
    expect(cat?.isStopword).toBe(false)
  })
  it('captures heading level 2', () => {
    const tokens = tokenizeContent('== Intro ==', 'fr')
    const headed = tokens.filter(t => t.type === 'word' && t.headingLevel === 2)
    expect(headed.length).toBeGreaterThan(0)
  })
  it('captures heading level 3', () => {
    const tokens = tokenizeContent('=== Section ===', 'fr')
    const headed = tokens.filter(t => t.type === 'word' && t.headingLevel === 3)
    expect(headed.length).toBeGreaterThan(0)
  })
  it('records word length metadata', () => {
    const tokens = tokenizeContent('chat', 'fr')
    const word = tokens.find(t => t.type === 'word')
    expect(word?.length).toBe(4)
  })
})

describe('tokenizeTitle', () => {
  it('tokenizes a multi-word title', () => {
    const tokens = tokenizeTitle('Le Petit Prince', 'fr')
    // TitleToken[] has NO .type field — use .isWord (ground truth: tokenize.ts line 17)
    const words = tokens.filter(t => t.isWord)
    expect(words).toHaveLength(3)
  })
  it('marks stopwords in a title', () => {
    const tokens = tokenizeTitle('Le Petit Prince', 'fr')
    const le = tokens.find(t => t.value === 'Le')
    const prince = tokens.find(t => t.value === 'Prince')
    expect(le?.isStopword).toBe(true)
    expect(prince?.isStopword).toBe(false)
  })
})

describe('maskTokensForClient', () => {
  it('strips value from non-stopword tokens', () => {
    const tokens = tokenizeContent('Le chat', 'fr')
    const masked = maskTokensForClient(tokens)
    // masked is Array<ContentToken & { visible: boolean }> — .type still present
    const chat = masked.find(t => t.type === 'word' && !t.isStopword)
    expect(chat?.value).toBe('')
    expect(chat?.visible).toBe(false)
  })
  it('preserves stopword values (they render visibly)', () => {
    const tokens = tokenizeContent('Le chat', 'fr')
    const masked = maskTokensForClient(tokens)
    const le = masked.find(t => t.type === 'word' && t.isStopword)
    expect(le?.value).toBe('Le')
    expect(le?.visible).toBe(true)
  })
})

describe('maskTitleForClient', () => {
  it('preserves stopwords in the title (revealed=true)', () => {
    const tokens = tokenizeTitle('Le Petit Prince', 'fr')
    const masked = maskTitleForClient(tokens)
    // masked items have { index, value, isStopword, revealed, length } — no .isWord, no .type
    const le = masked.find(t => t.isStopword === true && t.value === 'Le')
    expect(le).toBeDefined()
    expect(le?.revealed).toBe(true)
  })
  it('masks non-stopword words (revealed=false, value empty)', () => {
    const tokens = tokenizeTitle('Le Petit Prince', 'fr')
    const masked = maskTitleForClient(tokens)
    const prince = masked.find(t => !t.isStopword && t.length > 0)
    expect(prince).toBeDefined()
    expect(prince?.revealed).toBe(false)
    expect(prince?.value).toBe('')
  })
})
