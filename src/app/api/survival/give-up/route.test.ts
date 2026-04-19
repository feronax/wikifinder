/**
 * Phase 3 Plan 03 Task 2 — /api/survival/give-up route tests.
 * Loud-in-isolation regression pins per D-03b.
 * MODE-04 parity pin: when lives hit 0 the returned payload.score must equal
 * calculateSurvivalScore(expected inputs) — no drift between route and lib/scoring.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const GAME_ID = '00000000-0000-4000-8000-00000000aaaa'
const CUR_PAGE = '00000000-0000-4000-8000-00000000cccc'
const NEXT_PAGE_ROW_ID = 'page-next-0001'

const state: any = {
  user: { id: 'user-1' } as null | { id: string },
  gameRow: null as any,
  pagesRows: [] as any[],
  playedRows: [] as any[],
  rpcSpy: vi.fn(),
  rpcReturn: { data: {} as any, error: null as any },
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
  const pagesChain: any = {
    select: vi.fn(() => pagesChain),
    order: vi.fn(() => pagesChain),
    limit: vi.fn(async () => ({ data: state.pagesRows, error: null })),
    then: (resolve: any) => resolve({ data: state.pagesRows, error: null }),
  }

  const gamesTable = () => ({
    select: vi.fn((cols: string) => {
      if (cols === 'page_id') {
        return {
          eq: vi.fn(async () => ({ data: state.playedRows, error: null })),
        }
      }
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
        // The route currently doesn't chain .select() after update but handle both:
        then: (resolve: any) => resolve({ error: state.updateError }),
      }
      return chain
    }),
    insert: vi.fn(),
  })

  const guessesChain: any = {
    select: vi.fn(() => guessesChain),
    eq: vi.fn(async () => ({ data: state.guessRows, error: null })),
  }

  return {
    supabaseAdmin: {
      from: vi.fn((table: string) => {
        if (table === 'pages') return pagesChain
        if (table === 'games') return gamesTable()
        if (table === 'guesses') return guessesChain
        // idempotency_keys fail-open
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
      rpc: vi.fn((name: string, args: any) => {
        state.rpcSpy(name, args)
        return Promise.resolve(state.rpcReturn)
      }),
    },
  }
})

import { POST } from './route'
import { NextRequest } from 'next/server'
import { calculateScore, calculateSurvivalScore } from '@/lib/scoring'

function makePage(id: string) {
  return {
    id,
    wikipedia_title_fr: `Titre ${id}`,
    wikipedia_title_en: `Title ${id}`,
    wikipedia_url_fr: `https://fr.wikipedia.org/wiki/${id}`,
    wikipedia_url_en: `https://en.wikipedia.org/wiki/${id}`,
    tokens_fr: [{ type: 'word', value: 'Paris', isStopword: false }],
    tokens_en: [{ type: 'word', value: 'Paris', isStopword: false }],
    title_tokens_fr: [{ isWord: true, isStopword: false, value: 'Paris' }],
    title_tokens_en: [{ isWord: true, isStopword: false, value: 'Paris' }],
    date: '2026-04-18',
  }
}

function makeReq(body: any) {
  return new NextRequest('http://localhost/api/survival/give-up', {
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
    page_id: CUR_PAGE,
    mode: 'survival',
    mode_config: {
      lives_remaining: 2,
      chain: [],
      current_page_id: CUR_PAGE,
      language: 'fr',
      started_at: '2026-04-18T12:00:00Z',
    },
    started_at: '2026-04-18T12:00:00Z',
  }
  state.pagesRows = [makePage(NEXT_PAGE_ROW_ID)]
  state.playedRows = []
  state.guessRows = []
  state.updateError = null
  state.updateSpy.mockReset()
  state.rpcSpy.mockReset()
  state.rpcReturn = {
    data: {
      lives_remaining: 1,
      chain: [{ page_id: CUR_PAGE, outcome: 'gave_up' }],
      current_page_id: NEXT_PAGE_ROW_ID,
      language: 'fr',
    },
    error: null,
  }
})

describe('POST /api/survival/give-up', () => {
  it('unauthenticated returns 401', async () => {
    state.user = null
    const res = await POST(makeReq({ gameId: GAME_ID }))
    expect(res.status).toBe(401)
  })

  it('invalid body (non-uuid gameId) returns 400', async () => {
    const res = await POST(makeReq({ gameId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('happy path: lives 2→1 returns next payload with survival_advance_chain(gave_up)', async () => {
    const res = await POST(makeReq({ gameId: GAME_ID }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(state.rpcSpy).toHaveBeenCalledTimes(1)
    const [name, args] = state.rpcSpy.mock.calls[0]
    expect(name).toBe('survival_advance_chain')
    expect(args.p_outcome).toBe('gave_up')
    expect(args.p_game_id).toBe(GAME_ID)
    expect(args.p_completed_article).toBe(CUR_PAGE)
    expect(body.next).toBeDefined()
    expect(body.next.pageId).toBe(NEXT_PAGE_ROW_ID)
    expect(Array.isArray(body.next.wordHashSet)).toBe(true)
    expect(body.livesRemaining).toBe(1)
  })

  it('MODE-04 parity: lives 1→0 returns end-of-run payload with score=calculateSurvivalScore(...)', async () => {
    // Setup: current lives=1 so rpc returns lives=0; chain has one completed + one gave_up
    state.gameRow.mode_config.lives_remaining = 1
    state.rpcReturn = {
      data: {
        lives_remaining: 0,
        chain: [
          { page_id: 'p-done-1', outcome: 'completed' },
          { page_id: CUR_PAGE, outcome: 'gave_up' },
        ],
        current_page_id: NEXT_PAGE_ROW_ID,
        language: 'fr',
      },
      error: null,
    }
    state.guessRows = [
      // 45 guesses on p-done-1 → peak score 5000
      ...Array.from({ length: 45 }, () => ({ page_id: 'p-done-1' })),
    ]
    const res = await POST(makeReq({ gameId: GAME_ID }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ended).toBe(true)
    // Parity pin: route must match the pure function with the same inputs.
    const expected = calculateSurvivalScore(
      [calculateScore(45, true), 0],
      2
    )
    expect(body.score).toBe(expected)
    expect(body.chainLength).toBe(2)
    // Persisted via games.update
    expect(state.updateSpy).toHaveBeenCalledTimes(1)
    expect(state.updateSpy.mock.calls[0][0].score).toBe(expected)
    expect(state.updateSpy.mock.calls[0][0].completed).toBe(true)
    expect(typeof body.shareText).toBe('string')
    expect(body.shareText).toContain('Wikifinder Survival')
  })

  it('LOUD-IN-ISOLATION regression pin: games row not found returns 404 with specific message', async () => {
    state.gameRow = null
    const res = await POST(makeReq({ gameId: GAME_ID }))
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error).toBe('Run not found')
    if (!body.error) {
      throw new Error(
        'Survival give-up regression: missing game row returned non-404 without error body.'
      )
    }
  })

  it('run already ended (lives=0) returns 400 not 500', async () => {
    state.gameRow.mode_config.lives_remaining = 0
    const res = await POST(makeReq({ gameId: GAME_ID }))
    expect(res.status).toBe(400)
  })
})
