import { describe, it, expect } from 'vitest'
import { normalize, wordsMatch, splitOnApostrophe } from '@/lib/matching'

describe('normalize', () => {
  it('lowercases ASCII', () => {
    expect(normalize('CHAT')).toBe('chat')
  })
  it('strips NFD accents (é → e)', () => {
    expect(normalize('élève')).toBe('eleve')
  })
  it('strips NFD accents (à, ô, ç)', () => {
    expect(normalize('à la mode')).toBe('a la mode')
    expect(normalize('hôtel')).toBe('hotel')
    expect(normalize('français')).toBe('francais')
  })
  it('handles empty string', () => {
    expect(normalize('')).toBe('')
  })
})

describe('wordsMatch', () => {
  it('matches identical words', () => {
    expect(wordsMatch('chat', 'chat')).toBe(true)
  })
  it('matches case-insensitively via normalize', () => {
    expect(wordsMatch('Chat', 'chat')).toBe(true)
  })
  it('matches FR plural -s (chat ↔ chats)', () => {
    expect(wordsMatch('chat', 'chats')).toBe(true)
    expect(wordsMatch('chats', 'chat')).toBe(true)
  })
  it('matches FR plural -x (bijou ↔ bijoux)', () => {
    expect(wordsMatch('bijou', 'bijoux')).toBe(true)
    expect(wordsMatch('bijoux', 'bijou')).toBe(true)
  })
  it('matches EN plural -es (fox ↔ foxes)', () => {
    expect(wordsMatch('fox', 'foxes')).toBe(true)
    expect(wordsMatch('foxes', 'fox')).toBe(true)
  })
  it('matches FR plural aux→al (cheval ↔ chevaux)', () => {
    expect(wordsMatch('cheval', 'chevaux')).toBe(true)
    expect(wordsMatch('chevaux', 'cheval')).toBe(true)
  })
  it('rejects unrelated words', () => {
    expect(wordsMatch('chat', 'chien')).toBe(false)
  })
  it('matches accented and non-accented (élève ↔ eleve)', () => {
    expect(wordsMatch('élève', 'eleve')).toBe(true)
  })
})

describe('splitOnApostrophe', () => {
  it("splits on ASCII apostrophe (c'est → c, est)", () => {
    expect(splitOnApostrophe("c'est")).toEqual(['c', 'est'])
  })
  it('splits on Unicode curly apostrophe U+2019 (c\u2019est → c, est)', () => {
    expect(splitOnApostrophe('c\u2019est')).toEqual(['c', 'est'])
  })
  it('splits on Unicode left curly apostrophe U+2018 (c\u2018est → c, est)', () => {
    expect(splitOnApostrophe('c\u2018est')).toEqual(['c', 'est'])
  })
  it("splits d'un → d, un", () => {
    expect(splitOnApostrophe("d'un")).toEqual(['d', 'un'])
  })
  it('returns single element when no apostrophe', () => {
    expect(splitOnApostrophe('chat')).toEqual(['chat'])
  })
})
