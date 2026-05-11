// E2E: UAT-P1-IDEMPOTENCY — Phase 6 Plan 02 Task 2.
//
// Migrated from e2e/daily-game.spec.ts (Plan 19-03, 2026-05-11) when
// the legacy daily-game spec was deleted (D-01). The legacy spec was
// fully superseded by e2e/daily-game-new-ui.spec.ts for the daily-flow
// + sacred-latency coverage, but UAT-P1-IDEMPOTENCY is unrelated
// infrastructure (server-side replay-path coverage against the live
// public.idempotency_keys table) and must not be lost — Phase 19
// Research Open Question 1 explicitly recommended migration over
// deletion.
//
// Purpose: exercise the server-side idempotency replay path end-to-end
// against the newly-live production public.idempotency_keys table.
// Confirms that two POSTs to /api/game/guess with the same
// idempotencyKey return byte-identical bodies AND that exactly ONE row
// is written to public.guesses (proving the second call replayed the
// cached response rather than re-running the handler).
//
// Preconditions:
//   - public.idempotency_keys table applied in prod (see
//     .planning/phases/06-tech-debt-closeout/06-02-MIGRATION-VERIFY.md).
//   - PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD / SUPABASE_ACCESS_TOKEN
//     env vars set (same precedent as duel-flow.spec.ts). Skipped
//     gracefully in their absence — CI is the authoritative environment.
//
// Isolation:
//   - afterAll DELETEs the game + guesses + idempotency_keys rows
//     created by this test, keyed on game_id — safe re-runs.

import { test, expect } from './fixtures'
import type { APIRequestContext } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const SUPABASE_MGMT_URL =
  'https://api.supabase.com/v1/projects/nkmrrvuijffhtmrysejm/database/query'

async function runSql(query: string): Promise<unknown> {
  const pat = process.env.SUPABASE_ACCESS_TOKEN
  if (!pat) throw new Error('SUPABASE_ACCESS_TOKEN not set in env')
  const res = await fetch(SUPABASE_MGMT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase Management API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

const uatEmail = process.env.PLAYWRIGHT_TEST_EMAIL
const uatPassword = process.env.PLAYWRIGHT_TEST_PASSWORD
const uatCredsMissing =
  !uatEmail || !uatPassword || !process.env.SUPABASE_ACCESS_TOKEN

async function uatLoginViaUi(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(`${BASE_URL}/login`)
  for (const name of ['OK pour moi', 'Accepter', 'Accept all', 'Tout accepter']) {
    const btn = page.getByRole('button', { name }).first()
    const ok = await btn.click({ timeout: 1500 }).then(() => true).catch(() => false)
    if (ok) break
  }
  const emailInput = page.locator('input[type="email"], input[name="email"]').first()
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
  await emailInput.fill(email)
  await passwordInput.fill(password)
  await page
    .getByRole('button', { name: /se connecter|sign in|log in|connexion/i })
    .first()
    .click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
}

// Pick a known-benign word for the double-POST. We want a word Wiktionary
// will accept (not stopword-filtered by the client, not an invalid nonce)
// so the handler traverses the full commit() path. "test" is ASCII,
// validates in both fr + en Wiktionary, and is not a stopword in either
// language.
const UAT_GUESS_WORD = 'test'

test.describe('UAT-P1-IDEMPOTENCY — replay path exercises live idempotency_keys table', () => {
  let createdGameId: string | null = null

  test.afterAll(async () => {
    if (uatCredsMissing || !createdGameId) return
    const safe = createdGameId.replace(/'/g, "''")
    // Cleanup in FK-safe order: guesses + idempotency_keys first, then games.
    await runSql(`DELETE FROM public.guesses WHERE game_id = '${safe}';`)
    await runSql(`DELETE FROM public.idempotency_keys WHERE game_id = '${safe}';`)
    await runSql(`DELETE FROM public.games WHERE id = '${safe}';`)
  })

  test('UAT-P1-IDEMPOTENCY: same idempotencyKey produces one guesses row + identical response', async ({ page }) => {
    if (uatCredsMissing) {
      test.skip(
        true,
        'Set PLAYWRIGHT_TEST_EMAIL + PLAYWRIGHT_TEST_PASSWORD + SUPABASE_ACCESS_TOKEN to run UAT-P1-IDEMPOTENCY',
      )
      return
    }

    // 1) Authenticate so /api/game/start persists a row and idempotency applies.
    await uatLoginViaUi(page, uatEmail!, uatPassword!)

    // 2) Fetch today's page to get pageId (anonymous fetch is fine — same CDN cache).
    const todayRes = await page.request.get(`${BASE_URL}/api/game/today?lang=fr`)
    expect(todayRes.status()).toBe(200)
    const today = (await todayRes.json()) as { id: string }
    expect(today.id).toMatch(/^[0-9a-f-]{36}$/)

    // 3) Start a game (authed — cookies inherited from page context).
    const startRes = await page.request.post(`${BASE_URL}/api/game/start`, {
      data: { lang: 'fr', pageId: today.id },
    })
    expect(startRes.status()).toBe(200)
    const started = (await startRes.json()) as {
      saved: boolean
      game?: { id: string }
    }
    expect(started.saved).toBe(true)
    expect(started.game?.id).toMatch(/^[0-9a-f-]{36}$/)
    const gameId = started.game!.id
    createdGameId = gameId

    // 4) POST /api/game/guess twice with the SAME idempotencyKey + same body.
    //    The request context is the authed Playwright context, so cookies are shared.
    const idempotencyKey = crypto.randomUUID()
    const guessBody = {
      gameId,
      pageId: today.id,
      lang: 'fr',
      word: UAT_GUESS_WORD,
      idempotencyKey,
    }

    const doGuess = async (ctx: APIRequestContext) => {
      const res = await ctx.post(`${BASE_URL}/api/game/guess`, { data: guessBody })
      expect(res.status()).toBe(200)
      return (await res.json()) as Record<string, unknown>
    }

    const first = await doGuess(page.request)
    const second = await doGuess(page.request)

    // 5) Byte-identical bodies (the replay guarantee).
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))

    // 6) Exactly 1 guesses row was written — proves second call hit the replay
    //    branch and skipped the handler's INSERT.
    const guessCountRes = (await runSql(
      `SELECT COUNT(*)::int AS n FROM public.guesses WHERE game_id = '${gameId.replace(/'/g, "''")}';`,
    )) as Array<{ n: number }>
    expect(guessCountRes[0]?.n).toBe(1)

    // 7) Exactly 1 idempotency_keys row exists for this game — proves the
    //    commit() upsert landed (not just the replay lookup succeeding).
    const idemCountRes = (await runSql(
      `SELECT COUNT(*)::int AS n FROM public.idempotency_keys WHERE game_id = '${gameId.replace(/'/g, "''")}';`,
    )) as Array<{ n: number }>
    expect(idemCountRes[0]?.n).toBe(1)
  })
})
