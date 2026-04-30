import { describe, it, expect, vi, beforeEach } from 'vitest'

const state: {
  user: { id: string } | null
  follows: Array<{ followee_id: string; created_at: string }>
  profiles: Array<{ id: string; username: string; last_activity_at: string | null }>
  todayPageId: string | null
  todayGames: Array<{ user_id: string; page_id: string; guess_count: number; completed: boolean; duration_seconds: number }>
} = {
  user: { id: 'caller' },
  follows: [],
  profiles: [],
  todayPageId: 'page-today',
  todayGames: [],
}

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(async () => {
    const followsChain: any = {
      select: vi.fn(() => followsChain),
      eq: vi.fn(() => followsChain),
      order: vi.fn(async () => ({ data: state.follows, error: null })),
    }
    const profilesChain: any = {
      select: vi.fn(() => profilesChain),
      in: vi.fn(async () => ({ data: state.profiles, error: null })),
    }
    const pagesChain: any = {
      select: vi.fn(() => pagesChain),
      eq: vi.fn(() => pagesChain),
      maybeSingle: vi.fn(async () => ({
        data: state.todayPageId ? { id: state.todayPageId } : null,
        error: null,
      })),
    }
    const gamesChain: any = {
      select: vi.fn(() => gamesChain),
      in: vi.fn(() => gamesChain),
      eq: vi.fn(async () => ({ data: state.todayGames, error: null })),
    }
    return {
      auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
      from: vi.fn((table: string) => {
        if (table === 'follows') return followsChain
        if (table === 'profiles') return profilesChain
        if (table === 'pages') return pagesChain
        return gamesChain
      }),
    }
  }),
}))

import { GET } from './route'

const mkReq = () => new Request('http://x/api/friends')

describe('GET /api/friends', () => {
  beforeEach(() => {
    state.user = { id: 'caller' }
    state.follows = []
    state.profiles = []
    state.todayPageId = 'page-today'
    state.todayGames = []
  })

  it('returns 401 when anonymous', async () => {
    state.user = null
    const res = await GET(mkReq())
    expect(res.status).toBe(401)
  })

  it('returns empty friends when no follows', async () => {
    const body = await (await GET(mkReq())).json()
    expect(body).toEqual({ friends: [] })
  })

  it("status='online' when last_activity_at is within 5 min", async () => {
    state.follows = [{ followee_id: 'u1', created_at: 't' }]
    state.profiles = [{ id: 'u1', username: 'alice', last_activity_at: new Date(Date.now() - 60_000).toISOString() }]
    const body = await (await GET(mkReq())).json()
    expect(body.friends[0].status).toBe('online')
  })

  it("status='playing' when an open games row exists for today's page", async () => {
    state.follows = [{ followee_id: 'u1', created_at: 't' }]
    state.profiles = [{ id: 'u1', username: 'alice', last_activity_at: new Date(Date.now() - 3600_000).toISOString() }]
    state.todayGames = [{ user_id: 'u1', page_id: 'page-today', guess_count: 3, completed: false, duration_seconds: 20 }]
    const body = await (await GET(mkReq())).json()
    expect(body.friends[0].status).toBe('playing')
  })

  it("status='last_played' when activity > 5 min and no today game", async () => {
    state.follows = [{ followee_id: 'u1', created_at: 't' }]
    state.profiles = [{ id: 'u1', username: 'alice', last_activity_at: new Date(Date.now() - 3600_000).toISOString() }]
    const body = await (await GET(mkReq())).json()
    expect(body.friends[0].status).toBe('last_played')
    expect(body.friends[0].last_activity_at).toBeTruthy()
  })

  it('today_score is null when no games row for today', async () => {
    state.follows = [{ followee_id: 'u1', created_at: 't' }]
    state.profiles = [{ id: 'u1', username: 'alice', last_activity_at: null }]
    const body = await (await GET(mkReq())).json()
    expect(body.friends[0].today_score).toBeNull()
    expect(body.friends[0].status).toBe('never')
  })
})
