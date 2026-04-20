/**
 * Phase 3 Plan 03 Task 1 — /api/survival/start route.
 *
 * Loud-in-isolation regression pins (D-03b lineage):
 *   - Anonymous initial-start returns tokens WITHOUT persisting a games row
 *   - Anonymous chain-advance (gameId present) is rejected with explicit
 *     "Scored chain requires sign-in" (W-3 invariant)
 *   - Authed pool-exhausted path returns a page (never-repeat fallback D-06)
 *   - Empty `pages` table surfaces a specific error, not a vague crash
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (hoisted) ------------------------------------------------------

const state: any = {
  user: null as null | { id: string },
  pagesRows: [] as any[],
  playedRows: [] as any[],
  insertReturn: {
    data: { id: 'game-uuid-1111' },
    error: null as any,
  },
  insertSpy: vi.fn(),
  rpcSpy: vi.fn(),
  rpcReturn: {
    data: {
      lives_remaining: 3,
      chain: [
        { page_id: 'page-completed-1', outcome: 'completed' },
      ],
      current_page_id: 'page-next-1',
      language: 'fr',
    } as any,
    error: null as any,
  },
}

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })),
    },
  })),
}))

vi.mock('@/lib/supabase-admin', () => {
  const build = () => {
    const pagesChain: any = {
      select: vi.fn((cols: string) => {
        // Resume path does a per-id SELECT on pages with an explicit column list
        // ending in `.eq('id', currentPageId).maybeSingle()`. Detect that shape by
        // the presence of `tokens_fr` in the select string AND a later `.eq('id', ...)`
        // call below — we route the chain through a page-by-id branch.
        pagesChain._lastSelect = cols
        return pagesChain
      }),
      order: vi.fn(() => pagesChain),
      limit: vi.fn(async () => ({ data: state.pagesRows, error: null })),
      eq: vi.fn((col: string, val: string) => {
        // Resume branch: .eq('id', currentPageId).maybeSingle()
        if (col === 'id') {
          return {
            maybeSingle: vi.fn(async () => {
              const row = (state.pagesRows as any[]).find((p) => p.id === val) ?? null
              if (!row && state.resumePageRow) return { data: state.resumePageRow, error: null }
              return { data: row, error: null }
            }),
          }
        }
        return pagesChain
      }),
      then: undefined,
    }
    // When `.order()` is the terminal (no limit), make it awaitable too.
    pagesChain.order = vi.fn(() => ({
      ...pagesChain,
      limit: pagesChain.limit,
      then: (resolve: any) => resolve({ data: state.pagesRows, error: null }),
    }))

    const gamesSelectChain: any = {
      select: vi.fn(() => gamesSelectChain),
      eq: vi.fn(() => gamesSelectChain),
      maybeSingle: vi.fn(async () => ({ data: state.gameRow ?? null, error: null })),
    }

    const gamesInsertChain: any = {
      insert: vi.fn((payload: any) => {
        state.insertSpy(payload)
        return {
          select: vi.fn(() => ({
            single: vi.fn(async () => state.insertReturn),
          })),
        }
      }),
      select: vi.fn(() => gamesInsertChain),
      eq: vi.fn(() => gamesInsertChain),
      maybeSingle: vi.fn(async () => ({ data: state.gameRow ?? null, error: null })),
    }

    // games playedRows for pickNextSurvivalPage authed path
    const gamesPlayedChain: any = {
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: state.playedRows, error: null })),
      })),
    }

    // Resume lookup chain (MODE-05):
    // .select('id, page_id, lang, mode_config').eq('user_id', u).eq('mode', 'survival')
    //   .is('completed_at', null).gt('mode_config->>lives_remaining', '0')
    //   .order('started_at', { ascending: false }).limit(1).maybeSingle()
    const makeResumeChain = (): any => {
      const chain: any = {
        eq: vi.fn(() => chain),
        is: vi.fn(() => chain),
        gt: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({
          data: state.resumeRow ?? null,
          error: state.resumeError ?? null,
        })),
      }
      return chain
    }

    return {
      supabaseAdmin: {
        from: vi.fn((table: string) => {
          if (table === 'pages') return pagesChain
          if (table === 'games') {
            // Merge the behaviors: provides .insert, .select().eq().eq().eq().maybeSingle(),
            // .select('page_id').eq(userId) for the pool, and the MODE-05 resume lookup
            // chain (select('id, page_id, lang, mode_config')).
            return {
              insert: gamesInsertChain.insert,
              select: vi.fn((cols: string) => {
                if (cols === 'page_id') return gamesPlayedChain.select()
                if (typeof cols === 'string' && cols.includes('mode_config') && cols.includes('lang')) {
                  return makeResumeChain()
                }
                return gamesSelectChain
              }),
            }
          }
          // idempotency_keys — return a chain that resolves to no existing row
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
  }
  return build()
})

import { POST } from './route'
import { NextRequest } from 'next/server'

function makePage(id: string, overrides: Partial<Record<string, any>> = {}) {
  return {
    id,
    wikipedia_title_fr: `Titre ${id}`,
    wikipedia_title_en: `Title ${id}`,
    wikipedia_url_fr: `https://fr.wikipedia.org/wiki/${id}`,
    wikipedia_url_en: `https://en.wikipedia.org/wiki/${id}`,
    tokens_fr: [
      { type: 'word', value: 'Paris', isStopword: false },
      { type: 'space', value: ' ', isStopword: false },
      { type: 'word', value: 'est', isStopword: true },
    ],
    tokens_en: [
      { type: 'word', value: 'Paris', isStopword: false },
      { type: 'space', value: ' ', isStopword: false },
      { type: 'word', value: 'is', isStopword: true },
    ],
    title_tokens_fr: [
      { isWord: true, isStopword: false, value: 'Paris' },
    ],
    title_tokens_en: [
      { isWord: true, isStopword: false, value: 'Paris' },
    ],
    date: '2026-04-18',
    ...overrides,
  }
}

function makeReq(body: any) {
  return new NextRequest('http://localhost/api/survival/start', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

beforeEach(() => {
  state.user = null
  state.pagesRows = [makePage('page-uuid-0001'), makePage('page-uuid-0002')]
  state.playedRows = []
  state.gameRow = null
  state.resumeRow = null
  state.resumeError = null
  state.resumePageRow = null
  state.insertSpy.mockReset()
  state.rpcSpy.mockReset()
  state.insertReturn = { data: { id: 'game-uuid-1111' }, error: null }
  state.rpcReturn = {
    data: {
      lives_remaining: 3,
      chain: [{ page_id: 'page-completed-1', outcome: 'completed' }],
      current_page_id: 'page-next-1',
      language: 'fr',
    },
    error: null,
  }
})

describe('POST /api/survival/start', () => {
  it('anonymous initial-start returns payload and does NOT insert a games row', async () => {
    state.user = null
    const res = await POST(makeReq({ lang: 'fr' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.anonymous).toBe(true)
    expect(body.pageId).toMatch(/^page-uuid-/)
    expect(body.tokens).toBeDefined()
    expect(body.titleWords).toBeDefined()
    expect(Array.isArray(body.wordHashSet)).toBe(true)
    expect(body.livesRemaining).toBe(3)
    expect(body.chainLength).toBe(0)
    expect(body.language).toBe('fr')
    expect(state.insertSpy).not.toHaveBeenCalled()
  })

  it('anonymous chain-advance (gameId present) returns 400 "Scored chain requires sign-in"', async () => {
    state.user = null
    const res = await POST(makeReq({
      lang: 'fr',
      gameId: '00000000-0000-4000-8000-000000000000',
      completedPageId: '00000000-0000-4000-8000-000000000001',
    }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe('Scored chain requires sign-in')
  })

  it('invalid body (missing lang) returns 400', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('authed initial-start inserts games row with mode=survival + lives_remaining=3', async () => {
    state.user = { id: 'user-1' }
    const res = await POST(makeReq({ lang: 'fr' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.anonymous).toBe(false)
    expect(body.gameId).toBe('game-uuid-1111')
    expect(body.livesRemaining).toBe(3)
    expect(body.chainLength).toBe(0)
    expect(state.insertSpy).toHaveBeenCalledTimes(1)
    const payload = state.insertSpy.mock.calls[0][0]
    expect(payload.mode).toBe('survival')
    expect(payload.user_id).toBe('user-1')
    expect(payload.mode_config.lives_remaining).toBe(3)
    expect(payload.mode_config.chain).toEqual([])
    expect(payload.mode_config.language).toBe('fr')
  })

  it('authed chain-advance calls survival_advance_chain RPC with completed outcome', async () => {
    const GAME_ID = '00000000-0000-4000-8000-00000000aaaa'
    const COMPLETED_ID = '00000000-0000-4000-8000-00000000bbbb'
    state.user = { id: 'user-1' }
    state.gameRow = {
      id: GAME_ID,
      user_id: 'user-1',
      mode: 'survival',
      mode_config: {
        lives_remaining: 3,
        chain: [],
        current_page_id: COMPLETED_ID,
        language: 'fr',
      },
    }
    const res = await POST(makeReq({
      lang: 'fr',
      gameId: GAME_ID,
      completedPageId: COMPLETED_ID,
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(state.rpcSpy).toHaveBeenCalledTimes(1)
    const [name, args] = state.rpcSpy.mock.calls[0]
    expect(name).toBe('survival_advance_chain')
    expect(args.p_outcome).toBe('completed')
    expect(args.p_game_id).toBe(GAME_ID)
    expect(args.p_completed_article).toBe(COMPLETED_ID)
    expect(body.chainLength).toBeGreaterThan(0)
  })

  it('authed pool exhausted falls back to oldest-first (does not 500)', async () => {
    state.user = { id: 'user-1' }
    // User has played every page → playedSet covers pool → fallback to oldest
    state.pagesRows = [makePage('page-uuid-0001'), makePage('page-uuid-0002')]
    state.playedRows = [{ page_id: 'page-uuid-0001' }, { page_id: 'page-uuid-0002' }]
    const res = await POST(makeReq({ lang: 'fr' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.anonymous).toBe(false)
    // Fallback returns the first (oldest ASC) page
    expect(body.pageId).toBe('page-uuid-0001')
  })

  it('MODE-05: authed initial-start with an open chain RESUMES — returns existing gameId + restored state, no INSERT', async () => {
    const OPEN_GAME_ID = '00000000-0000-4000-8000-0000000cafe1'
    const CURRENT_PAGE_ID = 'page-uuid-0002'
    state.user = { id: 'user-1' }
    state.resumeRow = {
      id: OPEN_GAME_ID,
      page_id: CURRENT_PAGE_ID,
      lang: 'fr',
      mode_config: {
        lives_remaining: 2,
        chain: [{ page_id: 'page-completed-a', outcome: 'completed' }],
        current_page_id: CURRENT_PAGE_ID,
        language: 'fr',
      },
    }
    state.resumePageRow = makePage(CURRENT_PAGE_ID)
    const res = await POST(makeReq({ lang: 'fr' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.anonymous).toBe(false)
    expect(body.gameId).toBe(OPEN_GAME_ID)
    expect(body.pageId).toBe(CURRENT_PAGE_ID)
    expect(body.livesRemaining).toBe(2)
    expect(body.chainLength).toBe(1)
    expect(body.language).toBe('fr')
    // Critical MODE-05 invariant: resume MUST NOT INSERT a fresh row.
    expect(state.insertSpy).not.toHaveBeenCalled()
  })

  it('MODE-05: authed initial-start with NO open chain falls through to fresh INSERT (no regression)', async () => {
    state.user = { id: 'user-2' }
    state.resumeRow = null
    const res = await POST(makeReq({ lang: 'fr' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.anonymous).toBe(false)
    expect(body.gameId).toBe('game-uuid-1111')
    expect(body.chainLength).toBe(0)
    expect(state.insertSpy).toHaveBeenCalledTimes(1)
  })

  it('MODE-05: resume honors stored language even if request body lang differs', async () => {
    const OPEN_GAME_ID = '00000000-0000-4000-8000-0000000cafe2'
    const CURRENT_PAGE_ID = 'page-uuid-0001'
    state.user = { id: 'user-3' }
    state.resumeRow = {
      id: OPEN_GAME_ID,
      page_id: CURRENT_PAGE_ID,
      lang: 'en',
      mode_config: {
        lives_remaining: 1,
        chain: [],
        current_page_id: CURRENT_PAGE_ID,
        language: 'en',
      },
    }
    state.resumePageRow = makePage(CURRENT_PAGE_ID)
    const res = await POST(makeReq({ lang: 'fr' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.language).toBe('en')
    expect(body.gameId).toBe(OPEN_GAME_ID)
    expect(state.insertSpy).not.toHaveBeenCalled()
  })

  it('LOUD-IN-ISOLATION regression pin: empty pages table surfaces specific error (not a crash)', async () => {
    state.user = null
    state.pagesRows = []
    const res = await POST(makeReq({ lang: 'fr' }))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(typeof body.error).toBe('string')
    expect(body.error.length).toBeGreaterThan(0)
    // Belt-and-braces: if a future refactor returns a bare 500 without a body,
    // catch it loudly per D-03b.
    if (!body.error) {
      throw new Error(
        'Survival start regression: empty pool returned 500 without error body. ' +
        'See .planning/phases/03-survival-mode/03-03-PLAN.md Task 1.'
      )
    }
  })
})
