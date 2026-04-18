/**
 * SC-1 regression test (Phase 2.1 Plan 02).
 * Fails LOUD in isolation per D-03b.
 * Guards HARD-03 column hygiene (no tokens_fr/tokens_en leak).
 * Pins view-drift root cause documented in:
 *   .planning/phases/02.1-prod-regression-fixes/02.1-02-PROBE.md
 */
import { describe, it, expect, vi } from 'vitest'

// Mock supabaseAdmin at module boundary. The mock must reproduce the PostgREST
// chain shape (.from().select().eq().order().limit() resolves to { data, error })
// and the profiles enrichment path (.from('profiles').select().in()).
// Phase 3: leaderboard_survival chain added alongside existing leaderboard_daily
// for MODE-02 mode-isolation pin.

// Seed data kept at module scope so each describe block references the SAME
// instances — a test can mutate state.X before calling GET.
const state = {
  dailyRows: [
    {
      username: 'test-user-1',
      score: 4500,
      guess_count: 50,
      duration_seconds: 120,
      date: '2026-04-18',
      position: 1,
      lang: 'fr',
    },
    {
      username: 'test-user-2',
      score: 3800,
      guess_count: 80,
      duration_seconds: 180,
      date: '2026-04-18',
      position: 2,
      lang: 'fr',
    },
  ] as any[],
  survivalRows: [
    {
      username: 'survivor-1',
      score: 15000,
      completed_at: '2026-04-18T10:00:00Z',
      lang: 'fr',
      chain_length: 12,
      position: 1,
    },
    {
      username: 'survivor-2',
      score: 12000,
      completed_at: '2026-04-17T09:00:00Z',
      lang: 'en',
      chain_length: 10,
      position: 2,
    },
  ] as any[],
}

vi.mock('@/lib/supabase-admin', () => {
  const makeDailyChain = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(() => Promise.resolve({ data: state.dailyRows, error: null })),
  })

  const makeSurvivalChain = () => ({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(() => Promise.resolve({ data: state.survivalRows, error: null })),
  })

  const makeGlobalChain = () => ({
    select: vi.fn().mockReturnThis(),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
  })

  const profilesChain = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
  }

  return {
    supabaseAdmin: {
      from: vi.fn((table: string) => {
        if (table === 'profiles') return profilesChain
        if (table === 'leaderboard_daily') return makeDailyChain()
        if (table === 'leaderboard_survival') return makeSurvivalChain()
        if (table === 'leaderboard_global') return makeGlobalChain()
        return makeDailyChain()
      }),
    },
  }
})

import { GET } from './route'
import { NextRequest } from 'next/server'

describe('GET /api/leaderboard (type=daily) — SC-1 regression', () => {
  it('returns a non-empty leaderboard when view has rows for today', async () => {
    const req = new NextRequest(
      'http://localhost/api/leaderboard?type=daily&date=2026-04-18'
    )
    const res = await GET(req)
    const body = await res.json()
    expect(body.leaderboard).toBeDefined()
    expect(Array.isArray(body.leaderboard)).toBe(true)
    expect(body.leaderboard.length).toBeGreaterThan(0)
    // Pin the recovered column contract — `lang` must be present post-fix
    // (it was missing from the original route.ts SELECT and from the view).
    expect(body.leaderboard[0].lang).toMatch(/^(fr|en)$/i)
  })

  it('does NOT leak tokens_fr or tokens_en columns (HARD-03)', async () => {
    const req = new NextRequest(
      'http://localhost/api/leaderboard?type=daily&date=2026-04-18'
    )
    const res = await GET(req)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toMatch(/tokens_(fr|en)/)
  })

  it('fails LOUD when leaderboard is empty despite view rows (regression pin)', async () => {
    // This test exists so a future change that makes the daily tab silently
    // empty AGAIN will fail CI with this specific message per D-03b.
    const req = new NextRequest(
      'http://localhost/api/leaderboard?type=daily&date=2026-04-18'
    )
    const res = await GET(req)
    const body = await res.json()
    if (body.leaderboard?.length === 0) {
      throw new Error(
        'SC-1 regression: daily leaderboard returned empty despite view having rows. ' +
        'See .planning/phases/02.1-prod-regression-fixes/02.1-RESEARCH.md.'
      )
    }
    // Belt-and-braces: also assert length > 0 explicitly so a missing `if`
    // branch in a future refactor cannot silently skip the throw.
    expect(body.leaderboard.length).toBeGreaterThan(0)
  })
})

describe('GET /api/leaderboard (type=survival) — Phase 3 MODE-02', () => {
  it('returns rows ordered by position ASC from leaderboard_survival view', async () => {
    const req = new NextRequest('http://localhost/api/leaderboard?type=survival')
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(Array.isArray(body.leaderboard)).toBe(true)
    expect(body.leaderboard.length).toBe(2)
    expect(body.leaderboard[0].position).toBe(1)
    expect(body.leaderboard[0].username).toBe('survivor-1')
    expect(body.leaderboard[1].position).toBe(2)
  })

  it('LOUD-IN-ISOLATION: response shape matches leaderboard_survival view columns exactly (Pitfall 2 drift guard)', async () => {
    const req = new NextRequest('http://localhost/api/leaderboard?type=survival')
    const res = await GET(req)
    const body = await res.json()
    const entry = body.leaderboard[0]
    // Exactly these keys (plus favorite_badge from enrichment) — drift from
    // view columns would surface here first.
    const expectedKeys = [
      'username',
      'score',
      'completed_at',
      'lang',
      'chain_length',
      'position',
      'favorite_badge',
    ].sort()
    expect(Object.keys(entry).sort()).toEqual(expectedKeys)
    // Per-field assertions guarding view-drift (Phase 2.1 SC-1 recurrence).
    expect(typeof entry.username).toBe('string')
    expect(typeof entry.score).toBe('number')
    expect(typeof entry.chain_length).toBe('number')
    expect(typeof entry.position).toBe('number')
    expect(typeof entry.completed_at).toBe('string')
    expect(entry.lang).toMatch(/^(fr|en)$/)
  })

  it('empty survival view returns {leaderboard: []} not 500', async () => {
    state.survivalRows = []
    const req = new NextRequest('http://localhost/api/leaderboard?type=survival')
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.leaderboard).toEqual([])
    // Restore for other tests
    state.survivalRows = [
      {
        username: 'survivor-1',
        score: 15000,
        completed_at: '2026-04-18T10:00:00Z',
        lang: 'fr',
        chain_length: 12,
        position: 1,
      },
      {
        username: 'survivor-2',
        score: 12000,
        completed_at: '2026-04-17T09:00:00Z',
        lang: 'en',
        chain_length: 10,
        position: 2,
      },
    ]
  })

  it('MODE-02 mode-isolation pin: ?type=daily and ?type=survival return disjoint row sets', async () => {
    const dailyReq = new NextRequest(
      'http://localhost/api/leaderboard?type=daily&date=2026-04-18'
    )
    const survivalReq = new NextRequest('http://localhost/api/leaderboard?type=survival')
    const [dailyRes, survivalRes] = await Promise.all([GET(dailyReq), GET(survivalReq)])
    const dailyBody = await dailyRes.json()
    const survivalBody = await survivalRes.json()
    // Daily must not leak survival rows; survival must not leak daily rows.
    const dailyUsernames = new Set(dailyBody.leaderboard.map((r: any) => r.username))
    const survivalUsernames = new Set(
      survivalBody.leaderboard.map((r: any) => r.username)
    )
    // Disjoint sets — seeded data has distinct usernames per mode.
    for (const u of dailyUsernames) {
      expect(survivalUsernames.has(u as string)).toBe(false)
    }
    // Daily rows have `date` + `guess_count`; survival rows have `chain_length`.
    expect(dailyBody.leaderboard[0].chain_length).toBeUndefined()
    expect(survivalBody.leaderboard[0].guess_count).toBeUndefined()
  })
})
