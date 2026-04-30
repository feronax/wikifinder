/**
 * Phase 4 Plan 03 Task 4 — /api/game/start ?duel=<roomId> branch.
 * Covers: not_participant (403), expired (410), happy-path duel insert + room_players.game_id UPDATE.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ROOM = '00000000-0000-4000-8000-000000000001'

const state: any = {
  user: null as null | { id: string },
  room: null as any,
  rp: null as null | { user_id: string },
  insertReturn: { data: { id: 'dg-1' }, error: null as any },
  updateSpy: vi.fn(),
  insertSpy: vi.fn(),
  existingDuelRow: null as any,
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
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: state.rp, error: null })),
              })),
            })),
          })),
          update: vi.fn((payload: any) => {
            state.updateSpy(payload)
            return {
              eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
            }
          }),
        }
      }
      if (table === 'profiles') {
        // Phase 11 / FR-04 — fire-and-forget presence write. Mock the chain so it
        // doesn't throw synchronously and bubble into the 500 catch in handleDuelStart.
        return {
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        }
      }
      if (table === 'games') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({ data: state.existingDuelRow, error: null })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
          insert: vi.fn((payload: any) => {
            state.insertSpy(payload)
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => state.insertReturn),
              })),
            }
          }),
        }
      }
      return {}
    }),
  },
}))

import { POST } from './route'

const mkReq = (url: string) =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  }) as any

const farFuture = '2099-12-31T00:00:00Z'
const farPast = '2000-01-01T00:00:00Z'

describe('POST /api/game/start?duel=', () => {
  beforeEach(() => {
    state.user = { id: 'user-joiner' }
    state.room = {
      id: ROOM, creator_id: 'user-creator', page_id: 'page-1', lang: 'fr', expires_at: farFuture,
    }
    state.rp = { user_id: 'user-joiner' }
    state.insertReturn = { data: { id: 'dg-1', user_id: 'user-joiner', mode: 'duel' }, error: null }
    state.updateSpy.mockReset()
    state.insertSpy.mockReset()
    state.existingDuelRow = null
  })

  it('not_participant (403): third-party user not in room_players', async () => {
    state.rp = null
    const res = await POST(mkReq(`http://localhost/api/game/start?duel=${ROOM}`))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('not_participant')
    expect(state.insertSpy).not.toHaveBeenCalled()
    expect(state.updateSpy).not.toHaveBeenCalled()
  })

  it('expired (410): room.expires_at in past', async () => {
    state.room.expires_at = farPast
    const res = await POST(mkReq(`http://localhost/api/game/start?duel=${ROOM}`))
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.error).toBe('expired')
    expect(state.insertSpy).not.toHaveBeenCalled()
  })

  it('happy-path: inserts mode=duel game + updates room_players.game_id', async () => {
    const res = await POST(mkReq(`http://localhost/api/game/start?duel=${ROOM}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.saved).toBe(true)
    expect(body.game.id).toBe('dg-1')
    expect(state.insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-joiner',
        page_id: 'page-1',
        lang: 'fr',
        mode: 'duel',
        mode_config: expect.objectContaining({ room_id: ROOM }),
      }),
    )
    expect(state.updateSpy).toHaveBeenCalledWith({ game_id: 'dg-1' })
  })

  it('unauth: 401', async () => {
    state.user = null
    const res = await POST(mkReq(`http://localhost/api/game/start?duel=${ROOM}`))
    expect(res.status).toBe(401)
    expect(state.insertSpy).not.toHaveBeenCalled()
  })

  it('unknown duel: 404 Duel not found', async () => {
    state.room = null
    const res = await POST(mkReq(`http://localhost/api/game/start?duel=${ROOM}`))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Duel not found')
  })
})
