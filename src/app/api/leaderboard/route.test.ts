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
vi.mock('@/lib/supabase-admin', () => {
  const leaderboardRows = [
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
  ]

  const leaderboardChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: leaderboardRows, error: null }),
  }

  const profilesChain = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
  }

  return {
    supabaseAdmin: {
      from: vi.fn((table: string) => {
        if (table === 'profiles') return profilesChain
        return leaderboardChain
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
