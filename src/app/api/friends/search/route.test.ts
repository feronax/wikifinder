import { describe, it, expect, vi, beforeEach } from 'vitest'

const state: {
  user: { id: string } | null
  profilesData: Array<{ id: string; username: string }>
  followsData: Array<{ followee_id: string }>
  lastSelectArg: string | null
  lastIlikeArg: [string, string] | null
  rateLimitOk: boolean
} = {
  user: { id: 'caller-1' },
  profilesData: [],
  followsData: [],
  lastSelectArg: null,
  lastIlikeArg: null,
  rateLimitOk: true,
}

vi.mock('@/lib/rate-limit', () => ({
  rateLimitOk: vi.fn(async () => state.rateLimitOk),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(async () => {
    const profilesChain: any = {
      select: vi.fn((arg: string) => { state.lastSelectArg = arg; return profilesChain }),
      ilike: vi.fn((col: string, pattern: string) => { state.lastIlikeArg = [col, pattern]; return profilesChain }),
      neq: vi.fn(() => profilesChain),
      limit: vi.fn(async () => ({ data: state.profilesData, error: null })),
    }
    const followsChain: any = {
      select: vi.fn(() => followsChain),
      eq: vi.fn(() => followsChain),
      in: vi.fn(async () => ({ data: state.followsData, error: null })),
    }
    return {
      auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
      from: vi.fn((table: string) => table === 'follows' ? followsChain : profilesChain),
    }
  }),
}))

import { GET } from './route'

function mkReq(q: string) {
  return new Request(`http://x/api/friends/search?q=${encodeURIComponent(q)}`)
}

describe('GET /api/friends/search', () => {
  beforeEach(() => {
    state.user = { id: 'caller-1' }
    state.profilesData = []
    state.followsData = []
    state.lastSelectArg = null
    state.lastIlikeArg = null
    state.rateLimitOk = true
  })

  it('returns 401 when anonymous', async () => {
    state.user = null
    const res = await GET(mkReq('abc'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Non connecté' })
  })

  it('returns empty results when q.length < 2', async () => {
    const res = await GET(mkReq('a'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ results: [] })
  })

  it('returns empty results when q.length > 32', async () => {
    const res = await GET(mkReq('a'.repeat(33)))
    expect(await res.json()).toEqual({ results: [] })
  })

  it('escapes ilike wildcards (% and _)', async () => {
    await GET(mkReq('a%_b'))
    expect(state.lastIlikeArg).toEqual(['username', 'a\\%\\_b%'])
  })

  it('returns 429 when rate-limited', async () => {
    state.rateLimitOk = false
    const res = await GET(mkReq('abc'))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'Trop de requêtes' })
  })

  it('returns prefix matches with mapped shape when authed', async () => {
    state.profilesData = [
      { id: 'u1', username: 'alice' },
      { id: 'u2', username: 'albert' },
    ]
    const res = await GET(mkReq('al'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(2)
    expect(body.results[0]).toEqual({
      user_id: 'u1', pseudonym: 'alice', avatar_initial: 'A', is_followed: false,
    })
  })

  it('sets is_followed=true for matches in follows', async () => {
    state.profilesData = [
      { id: 'u1', username: 'alice' },
      { id: 'u2', username: 'albert' },
    ]
    state.followsData = [{ followee_id: 'u1' }]
    const body = await (await GET(mkReq('al'))).json()
    expect(body.results.find((r: any) => r.user_id === 'u1').is_followed).toBe(true)
    expect(body.results.find((r: any) => r.user_id === 'u2').is_followed).toBe(false)
  })

  it('D-04: does NOT project last_activity_at', async () => {
    state.profilesData = [{ id: 'u1', username: 'alice' }]
    await GET(mkReq('al'))
    expect(state.lastSelectArg).toBe('id, username')
    expect(state.lastSelectArg).not.toContain('last_activity_at')
  })
})
