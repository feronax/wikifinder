/**
 * Phase 4 Plan 03 Task 3 — GET /api/duel/[id] reveal gate.
 * Pitfall 7 regression pin: pre-reveal body must never contain opponent's
 * guessCount or durationSec.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const farFuture = '2099-12-31T00:00:00Z'
const farPast = '2000-01-01T00:00:00Z'

const state: any = {
  user: null as null | { id: string },
  room: null as any,
  players: [] as Array<{ user_id: string; role: string; game_id: string | null }>,
  games: [] as Array<any>,
  profiles: [] as Array<{ id: string; username: string }>,
  pageRow: { wikipedia_title_fr: 'Photosynthèse', wikipedia_title_en: 'Photosynthesis' } as any,
}

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
  })),
}))

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'multiplayer_rooms') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: state.room, error: null })),
            })),
          })),
        }
      }
      if (table === 'room_players') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: state.players, error: null })),
          })),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: state.profiles, error: null })),
          })),
        }
      }
      if (table === 'pages') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: state.pageRow, error: null })),
            })),
          })),
        }
      }
      if (table === 'games') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: state.games, error: null })),
          })),
        }
      }
      return {}
    }),
  },
}))

import { GET } from './route'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const mkReq = () => new Request('http://localhost/api/duel/room-1') as any

describe('GET /api/duel/[id]', () => {
  beforeEach(() => {
    state.user = null
    state.room = { id: 'room-1', creator_id: 'u-a', page_id: 'p-1', lang: 'fr', expires_at: farFuture }
    state.players = [
      { user_id: 'u-a', role: 'creator', game_id: null },
      { user_id: 'u-b', role: 'joiner', game_id: null },
    ]
    state.games = []
    state.profiles = [
      { id: 'u-a', username: 'Alice' },
      { id: 'u-b', username: 'Bob' },
    ]
  })

  it('room not found: 404', async () => {
    state.room = null
    const res = await GET(mkReq(), ctx('unknown'))
    expect(res.status).toBe(404)
  })

  it('third-party viewer: state=private, no comparison', async () => {
    state.user = { id: 'u-c' }
    state.games = [
      { id: 'g-a', user_id: 'u-a', guess_count: 10, duration_seconds: 60, completed: true, completed_at: '2026-04-19T10:00:00Z', won: true },
      { id: 'g-b', user_id: 'u-b', guess_count: 20, duration_seconds: 120, completed: true, completed_at: '2026-04-19T10:05:00Z', won: true },
    ]
    state.players = [
      { user_id: 'u-a', role: 'creator', game_id: 'g-a' },
      { user_id: 'u-b', role: 'joiner', game_id: 'g-b' },
    ]
    const res = await GET(mkReq(), ctx('room-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.state).toBe('private')
    expect(body.comparison).toBeUndefined()
    expect(body.viewer.role).toBe('third-party')
  })

  it('anon viewer: lobby, no opponent payload', async () => {
    state.user = null
    const res = await GET(mkReq(), ctx('room-1'))
    const body = await res.json()
    expect(body.state).toBe('lobby')
    expect(body.viewer.role).toBe('candidate')
    expect(body.comparison).toBeUndefined()
  })

  it('PRE-REVEAL PITFALL 7: opponent payload has NO guessCount or durationSec', async () => {
    state.user = { id: 'u-a' }
    // u-a not yet started; u-b not yet started either
    const res = await GET(mkReq(), ctx('room-1'))
    const body = await res.json()
    expect(body.state).toBe('lobby')
    expect(body.comparison).toBeUndefined()
    expect(body.opponent).toBeTruthy()
    expect(body.opponent.username).toBe('Bob')
    expect(body.opponent.state).toBe('playing')
    expect(body.opponent.guessCount).toBeUndefined()
    expect(body.opponent.durationSec).toBeUndefined()
    // Stringified body must not leak any opponent numeric signal
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('guess_count')
    expect(raw).not.toContain('duration_seconds')
  })

  it('PRE-REVEAL viewer finished, opponent playing → state=waiting, no comparison, opponent stays {username,state}', async () => {
    state.user = { id: 'u-a' }
    state.games = [
      { id: 'g-a', user_id: 'u-a', guess_count: 15, duration_seconds: 90, completed: true, completed_at: '2026-04-19T10:00:00Z', won: true },
    ]
    state.players = [
      { user_id: 'u-a', role: 'creator', game_id: 'g-a' },
      { user_id: 'u-b', role: 'joiner', game_id: null },
    ]
    const res = await GET(mkReq(), ctx('room-1'))
    const body = await res.json()
    expect(body.state).toBe('waiting')
    expect(body.comparison).toBeUndefined()
    expect(body.opponent.state).toBe('playing')
    expect(body.opponent.guessCount).toBeUndefined()
    // Viewer's own numbers ARE present in pre-reveal
    expect(body.viewer.guessCount).toBe(15)
  })

  it('REVEAL both finished not expired → state=ready, comparison present', async () => {
    state.user = { id: 'u-a' }
    state.games = [
      { id: 'g-a', user_id: 'u-a', guess_count: 10, duration_seconds: 60, completed: true, completed_at: '2026-04-19T10:00:00Z', won: true },
      { id: 'g-b', user_id: 'u-b', guess_count: 20, duration_seconds: 120, completed: true, completed_at: '2026-04-19T10:05:00Z', won: true },
    ]
    state.players = [
      { user_id: 'u-a', role: 'creator', game_id: 'g-a' },
      { user_id: 'u-b', role: 'joiner', game_id: 'g-b' },
    ]
    const res = await GET(mkReq(), ctx('room-1'))
    const body = await res.json()
    expect(body.state).toBe('ready')
    expect(body.comparison).toBeTruthy()
    expect(body.comparison.kind).toBe('winner')
    expect(body.comparison.winner.userId).toBe('u-a')
  })

  it('REVEAL one finisher + expired → state=expired-one, winner=finisher', async () => {
    state.user = { id: 'u-a' }
    state.room.expires_at = farPast
    state.games = [
      { id: 'g-a', user_id: 'u-a', guess_count: 10, duration_seconds: 60, completed: true, completed_at: '2026-04-19T10:00:00Z', won: true },
    ]
    state.players = [
      { user_id: 'u-a', role: 'creator', game_id: 'g-a' },
      { user_id: 'u-b', role: 'joiner', game_id: null },
    ]
    const res = await GET(mkReq(), ctx('room-1'))
    const body = await res.json()
    expect(body.state).toBe('expired-one')
    expect(body.comparison.kind).toBe('winner')
    expect(body.comparison.winner.userId).toBe('u-a')
    expect(body.comparison.loser.dnf).toBe(true)
  })

  it('REVEAL neither finished + expired → state=expired-none, no winner', async () => {
    state.user = { id: 'u-a' }
    state.room.expires_at = farPast
    state.games = []
    state.players = [
      { user_id: 'u-a', role: 'creator', game_id: null },
      { user_id: 'u-b', role: 'joiner', game_id: null },
    ]
    const res = await GET(mkReq(), ctx('room-1'))
    const body = await res.json()
    expect(body.state).toBe('expired-none')
  })

  it('REVEAL only creator enrolled + expired → state=expired-none', async () => {
    state.user = { id: 'u-a' }
    state.room.expires_at = farPast
    state.games = []
    state.players = [{ user_id: 'u-a', role: 'creator', game_id: null }]
    const res = await GET(mkReq(), ctx('room-1'))
    const body = await res.json()
    expect(body.state).toBe('expired-none')
  })
})
