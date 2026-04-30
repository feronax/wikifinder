import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = {
  stored: new Map<string, string>(),
  getReturn: null as string | null,
  failOpen: false,
}

vi.mock('@/lib/redis', () => ({
  safeGet: vi.fn(async (key: string) => {
    if (state.failOpen) return null
    return state.stored.get(key) ?? null
  }),
  safeSet: vi.fn(async (key: string, value: string) => {
    if (state.failOpen) return
    state.stored.set(key, value)
  }),
}))

import { rateLimitOk } from './rate-limit'
import { safeSet } from '@/lib/redis'

describe('rateLimitOk', () => {
  beforeEach(() => {
    state.stored.clear()
    state.failOpen = false
    vi.clearAllMocks()
  })

  it('returns true on first call and writes count=1', async () => {
    const ok = await rateLimitOk('user-1', 'test-route', 10)
    expect(ok).toBe(true)
    expect(safeSet).toHaveBeenCalledWith(
      expect.stringMatching(/^ratelimit:v1:test-route:user-1:\d+$/),
      '1',
      65,
    )
  })

  it('returns true when count is under limit', async () => {
    const window = Math.floor(Date.now() / 1000 / 60)
    state.stored.set(`ratelimit:v1:test-route:user-1:${window}`, '5')
    const ok = await rateLimitOk('user-1', 'test-route', 10)
    expect(ok).toBe(true)
  })

  it('returns false when count is at or over limit', async () => {
    const window = Math.floor(Date.now() / 1000 / 60)
    state.stored.set(`ratelimit:v1:test-route:user-1:${window}`, '10')
    const ok = await rateLimitOk('user-1', 'test-route', 10)
    expect(ok).toBe(false)
  })

  it('fails open when Redis is unavailable', async () => {
    state.failOpen = true
    for (let i = 0; i < 20; i++) {
      expect(await rateLimitOk('user-1', 'test-route', 5)).toBe(true)
    }
  })

  it('segregates keys by route and userId', async () => {
    await rateLimitOk('user-1', 'friends-search', 10)
    await rateLimitOk('user-1', 'friends', 10)
    await rateLimitOk('user-2', 'friends-search', 10)
    const keys = Array.from(state.stored.keys())
    expect(keys.filter(k => k.includes(':friends-search:user-1:')).length).toBe(1)
    expect(keys.filter(k => k.includes(':friends:user-1:')).length).toBe(1)
    expect(keys.filter(k => k.includes(':friends-search:user-2:')).length).toBe(1)
  })
})
