/**
 * Phase 4 Plan 03 Task 2 — /api/duel/join route.
 * Covers: happy path, unauth, bad UUID, not found, lang mismatch (MP-07), self-duel,
 * expired, dup-join idempotent (Pitfall 5).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const UUID = '00000000-0000-4000-8000-000000000000'
const UUID2 = '11111111-1111-4111-8111-111111111111'

const state: any = {
  user: null as null | { id: string },
  room: null as any,
  upsertReturn: { error: null as any },
  upsertSpy: vi.fn(),
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
          upsert: vi.fn(async (payload: any, opts: any) => {
            state.upsertSpy(payload, opts)
            return state.upsertReturn
          }),
        }
      }
      return {}
    }),
  },
}))

import { POST } from './route'

const req = (body: Record<string, unknown>) =>
  new Request('http://localhost/api/duel/join', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as any

const farFuture = '2099-12-31T00:00:00Z'
const farPast = '2000-01-01T00:00:00Z'

describe('POST /api/duel/join', () => {
  beforeEach(() => {
    state.user = { id: 'user-joiner' }
    state.room = {
      id: UUID, creator_id: 'user-creator', page_id: 'page-1', lang: 'fr', expires_at: farFuture,
    }
    state.upsertReturn = { error: null }
    state.upsertSpy.mockReset()
  })

  it('happy path: joins with matching lang, returns role=joiner', async () => {
    const res = await POST(req({ roomId: UUID, expectedLang: 'fr' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ roomId: UUID, role: 'joiner', lang: 'fr' })
    expect(state.upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ room_id: UUID, user_id: 'user-joiner', role: 'joiner' }),
      expect.objectContaining({ onConflict: 'room_id,user_id', ignoreDuplicates: true }),
    )
  })

  it('unauth: 401', async () => {
    state.user = null
    const res = await POST(req({ roomId: UUID, expectedLang: 'fr' }))
    expect(res.status).toBe(401)
  })

  it('bad UUID: 400', async () => {
    const res = await POST(req({ roomId: 'not-uuid', expectedLang: 'fr' }))
    expect(res.status).toBe(400)
  })

  it('room not found: 404', async () => {
    state.room = null
    const res = await POST(req({ roomId: UUID, expectedLang: 'fr' }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Duel not found')
  })

  it('lang mismatch (MP-07): 409 with machine-readable shape', async () => {
    state.room.lang = 'fr'
    const res = await POST(req({ roomId: UUID, expectedLang: 'en' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toEqual({ error: 'lang_mismatch', expected: 'fr', got: 'en' })
  })

  it('self-duel: 409 self_join', async () => {
    state.user = { id: 'user-creator' }
    const res = await POST(req({ roomId: UUID, expectedLang: 'fr' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('self_join')
  })

  it('expired room: 410', async () => {
    state.room.expires_at = farPast
    const res = await POST(req({ roomId: UUID, expectedLang: 'fr' }))
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.error).toBe('expired')
  })

  it('dup-join (Pitfall 5): second call 200 with same payload, upsert ignoreDuplicates', async () => {
    await POST(req({ roomId: UUID, expectedLang: 'fr' }))
    const res2 = await POST(req({ roomId: UUID, expectedLang: 'fr' }))
    expect(res2.status).toBe(200)
    expect(state.upsertSpy).toHaveBeenCalledTimes(2)
    // Both calls used onConflict DO NOTHING
    expect(state.upsertSpy.mock.calls[1][1]).toEqual(
      expect.objectContaining({ ignoreDuplicates: true }),
    )
  })
})
