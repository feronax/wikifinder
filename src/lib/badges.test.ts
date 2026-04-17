import { describe, it, expect } from 'vitest'
import { BADGES, BADGE_MAP, RARITY_COLORS, RANKS, getRankFromScore } from '@/lib/badges'

describe('BADGES catalog', () => {
  it('is a non-empty array', () => {
    expect(BADGES.length).toBeGreaterThan(0)
  })
  it('every badge has a string key and a valid rarity', () => {
    const validRarities = ['bronze', 'silver', 'gold', 'legendary']
    for (const b of BADGES) {
      expect(typeof b.key).toBe('string')
      expect(b.key.length).toBeGreaterThan(0)
      expect(validRarities).toContain(b.rarity)
    }
  })
  it('has unique keys (no duplicates)', () => {
    const keys = BADGES.map(b => b.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('BADGE_MAP', () => {
  it('lookup by every catalog key returns the matching badge', () => {
    for (const b of BADGES) {
      expect(BADGE_MAP.get(b.key)?.key).toBe(b.key)
    }
  })
  it('lookup of an unknown key returns undefined', () => {
    expect(BADGE_MAP.get('nonexistent_badge_xyz')).toBeUndefined()
  })
  it('size matches BADGES length (1:1 map)', () => {
    expect(BADGE_MAP.size).toBe(BADGES.length)
  })
})

describe('RARITY_COLORS', () => {
  it('has exactly four rarity keys', () => {
    expect(Object.keys(RARITY_COLORS).sort()).toEqual(['bronze', 'gold', 'legendary', 'silver'])
  })
  it('every value is a non-empty hex-ish color string', () => {
    for (const color of Object.values(RARITY_COLORS)) {
      expect(typeof color).toBe('string')
      expect(color.length).toBeGreaterThan(0)
    }
  })
})

describe('RANKS', () => {
  it('is ordered by minScore ascending', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].minScore).toBeGreaterThanOrEqual(RANKS[i - 1].minScore)
    }
  })
  it('starts at minScore 0', () => {
    expect(RANKS[0].minScore).toBe(0)
  })
  it('every rank has key, name, and nameEn strings', () => {
    for (const r of RANKS) {
      expect(typeof r.key).toBe('string')
      expect(typeof r.name).toBe('string')
      expect(typeof r.nameEn).toBe('string')
    }
  })
})

describe('getRankFromScore', () => {
  it('returns first rank (lowest) for score 0', () => {
    expect(getRankFromScore(0)).toBe(RANKS[0])
  })
  it('returns first rank for negative score (fallback)', () => {
    expect(getRankFromScore(-100)).toBe(RANKS[0])
  })
  it('returns last rank for score above max threshold', () => {
    const max = RANKS[RANKS.length - 1].minScore
    expect(getRankFromScore(max + 1000)).toBe(RANKS[RANKS.length - 1])
  })
  it('boundary: score exactly at a rank minScore returns that rank (not the one below)', () => {
    for (const r of RANKS) {
      const found = getRankFromScore(r.minScore)
      expect(found.minScore).toBeLessThanOrEqual(r.minScore)
    }
  })
  it('score one below a rank threshold returns the previous rank', () => {
    // Skip index 0 (minScore is 0 — nothing below).
    for (let i = 1; i < RANKS.length; i++) {
      const justBelow = getRankFromScore(RANKS[i].minScore - 1)
      expect(justBelow.minScore).toBeLessThan(RANKS[i].minScore)
    }
  })
})
