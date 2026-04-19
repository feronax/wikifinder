/**
 * Phase 3 Plan 03 Task 2 — /api/survival/end route tests.
 * Loud-in-isolation regression pin per D-03b.
 * MODE-04 parity pin: numeric assertion tying body.score to
 * calculateSurvivalScore(...) with explicit inputs — guards client/server drift.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const GAME_ID = '00000000-0000-4000-8000-00000000dddd'

const state: any = {
  user: { id: 'user-1' } as null | { id: string },
  gameRow: null as any,
  guessRows: [] as any[],
  updateSpy: vi.fn(),
  updateError: null as any,
}

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
  })),
}))

vi.mock('@/lib/supabase-admin', () => {
  const gamesTable = () => ({
    select: vi.fn(() => {
      const chain: any = {
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({ data: state.gameRow, error: null })),
      }
      return chain
    }),
    update: vi.fn((payload: any) => {
      state.updateSpy(payload)
      const chain: any = {
        eq: vi.fn(() => chain),
        then: (resolve: any) => resolve({ error: state.updateError }),
      }
      return chain
    }),
  })

  const guessesChain: any = {
    select: vi.fn(() => guessesChain),
    eq: vi.fn(async () => ({ data: state.guessRows, error: null })),
  }

  return {
    supabaseAdmin: {
      from: vi.fn((table: string) => {
        if (table === 'games') return gamesTable()
        if (table === 'guesses') return guessesChain
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
          })),
          upsert: vi.fn(async () => ({ error: null })),
          delete: vi.fn(() => ({ lt: vi.fn(async () => ({ error: null })) })),
        }
      }),
      rpc: vi.fn(),
    },
  }
})

import { POST } from './route'
import { NextRequest } from 'next/server'
import { calculateScore, calculateSurvivalScore } from '@/lib/scoring'

function makeReq(body: any) {
  return new NextRequest('http://localhost/api/survival/end', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

beforeEach(() => {
  state.user = { id: 'user-1' }
  state.gameRow = {
    id: GAME_ID,
    user_id: 'user-1',
    mode: 'survival',
    mode_config: {
      chain: [
        { page_id: 'p-1', outcome: 'completed' },
        { page_id: 'p-2', outcome: 'completed' },
        { page_id: 'p-3', outcome: 'gave_up' },
      ],
      started_at: '2026-04-18T12:00:00Z',
      language: 'fr',
    },
    started_at: '2026-04-18T12:00:00Z',
    completed: false,
  }
  // 45 guesses on p-1 (perfect), 100 guesses on p-2 (mid), zero on p-3 (gave up)
  state.guessRows = [
    ...Array.from({ length: 45 }, () => ({ page_id: 'p-1' })),
    ...Array.from({ length: 100 }, () => ({ page_id: 'p-2' })),
  ]
  state.updateError = null
  state.updateSpy.mockReset()
})

describe('POST /api/survival/end', () => {
  it('unauthenticated returns 401', async () => {
    state.user = null
    const res = await POST(makeReq({ gameId: GAME_ID }))
    expect(res.status).toBe(401)
  })

  it('invalid body (missing gameId) returns 400', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('happy path: returns {score, chainLength, chain, durationSec, shareText}', async () => {
    const res = await POST(makeReq({ gameId: GAME_ID }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(typeof body.score).toBe('number')
    expect(body.chainLength).toBe(3)
    expect(Array.isArray(body.chain)).toBe(true)
    expect(body.chain.map((e: any) => e.outcome)).toEqual([
      'completed',
      'completed',
      'gave_up',
    ])
    expect(typeof body.durationSec).toBe('number')
    expect(body.durationSec).toBeGreaterThanOrEqual(0)
    expect(typeof body.shareText).toBe('string')
    expect(body.shareText).toContain('Wikifinder Survival')
    expect(body.shareText).toContain('🟩🟩🟥')
  })

  it('persists score + completed + completed_at via games.update', async () => {
    await POST(makeReq({ gameId: GAME_ID }))
    expect(state.updateSpy).toHaveBeenCalledTimes(1)
    const payload = state.updateSpy.mock.calls[0][0]
    expect(typeof payload.score).toBe('number')
    expect(payload.completed).toBe(true)
    expect(typeof payload.completed_at).toBe('string')
  })

  it('MODE-04 parity pin: body.score === calculateSurvivalScore(calculated per-article, chainLength)', async () => {
    const res = await POST(makeReq({ gameId: GAME_ID }))
    const body = await res.json()
    // Explicit numeric re-derivation from the same inputs the route had.
    const expectedArticleScores = [
      calculateScore(45, true),  // p-1 completed at peak
      calculateScore(100, true), // p-2 completed with more guesses
      0,                          // p-3 gave_up → 0
    ]
    const expected = calculateSurvivalScore(expectedArticleScores, 3)
    expect(body.score).toBe(expected)
    // Also pins the update payload
    expect(state.updateSpy.mock.calls[0][0].score).toBe(expected)
  })

  it('LOUD-IN-ISOLATION regression pin: game not found returns 404 not silent 200', async () => {
    state.gameRow = null
    const res = await POST(makeReq({ gameId: GAME_ID }))
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error).toBe('Run not found')
    if (res.status !== 404) {
      throw new Error(
        'Survival end regression: missing game returned non-404 silently. ' +
        'See .planning/phases/03-survival-mode/03-03-PLAN.md Task 2.'
      )
    }
  })
})
