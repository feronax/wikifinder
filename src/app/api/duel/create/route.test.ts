/**
 * Phase 4 Plan 03 Task 1 — /api/duel/create route.
 * Covers: happy path, unauth, invalid body, no-daily, idempotency replay.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state: any = {
  user: null as null | { id: string },
  pageRow: null as null | { id: string },
  roomInsertReturn: { data: { id: 'room-uuid-1' }, error: null as any },
  rpInsertReturn: { error: null as any },
  slot: { kind: 'fresh' as 'fresh' | 'replay', response: null as any },
  roomInsertSpy: vi.fn(),
  rpInsertSpy: vi.fn(),
}

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
  })),
}))

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'pages') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: state.pageRow, error: null })),
            })),
          })),
        }
      }
      if (table === 'multiplayer_rooms') {
        return {
          insert: vi.fn((payload: any) => {
            state.roomInsertSpy(payload)
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => state.roomInsertReturn),
              })),
            }
          }),
        }
      }
      if (table === 'room_players') {
        return {
          insert: vi.fn(async (payload: any) => {
            state.rpInsertSpy(payload)
            return state.rpInsertReturn
          }),
        }
      }
      return {}
    }),
  },
}))

vi.mock('@/lib/idempotency', () => ({
  acquireIdempotencySlot: vi.fn(async () => {
    if (state.slot.kind === 'replay') {
      return { kind: 'replay', response: state.slot.response }
    }
    return { kind: 'fresh', commit: vi.fn(async () => {}) }
  }),
}))

import { POST } from './route'

const req = (body: Record<string, unknown>) =>
  new Request('http://localhost/api/duel/create', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as any

describe('POST /api/duel/create', () => {
  beforeEach(() => {
    state.user = { id: 'user-a' }
    state.pageRow = { id: 'page-1' }
    state.roomInsertReturn = { data: { id: 'room-uuid-1' }, error: null }
    state.rpInsertReturn = { error: null }
    state.slot = { kind: 'fresh', response: null }
    state.roomInsertSpy.mockReset()
    state.rpInsertSpy.mockReset()
  })

  it('happy path: creates room + enrolls creator + returns duelUrl', async () => {
    const res = await POST(req({ lang: 'fr' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.roomId).toBe('room-uuid-1')
    expect(body.duelUrl).toBe('/duel/room-uuid-1')
    expect(state.roomInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ creator_id: 'user-a', page_id: 'page-1', lang: 'fr' }),
    )
    expect(state.rpInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ room_id: 'room-uuid-1', user_id: 'user-a', role: 'creator' }),
    )
  })

  it('unauth: returns 401', async () => {
    state.user = null
    const res = await POST(req({ lang: 'fr' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Sign-in required')
  })

  it('invalid body (missing lang): 400', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
  })

  it('no daily article today: 404', async () => {
    state.pageRow = null
    const res = await POST(req({ lang: 'fr' }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('No daily article')
  })

  it('idempotency replay: returns cached body, no new insert', async () => {
    state.slot = { kind: 'replay', response: { roomId: 'cached-1', duelUrl: '/duel/cached-1' } }
    const res = await POST(req({
      lang: 'fr',
      idempotencyKey: '00000000-0000-4000-8000-000000000000',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.roomId).toBe('cached-1')
    expect(state.roomInsertSpy).not.toHaveBeenCalled()
  })
})
