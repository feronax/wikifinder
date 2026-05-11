// E2E: plays today's real daily article from prod Supabase.
//
// Sacred-metric assertion per iteration (the CI gate):
//   - performance.measure('guess:reveal', 'guess:enter', 'guess:reveal-painted') < 50ms
//
// Observability-only (measured + logged, NOT asserted as of D-15, 2026-04-17):
//   - performance.measure('guess:rtt', 'guess:fetch-start', 'guess:fetch-end') — the
//     server round-trip. D-15 supersedes D-09's CI-gate role: rttMs depends on the
//     Wiktionary + Supabase cold-path round-trip, which PROJECT.md explicitly calls
//     out as external ("Wikipedia + Wiktionary APIs are external; must handle rate
//     limits, format changes, and outages"), and PROJECT.md's Core Value scopes the
//     "<50ms visible" budget to the OPTIMISTIC client reveal only — the background
//     server reconciliation is explicitly non-perceived. Keeping the mark + a
//     per-iteration console.log retains the full RUM-forward signal in CI logs
//     without gating merges on external-dependency variance we cannot mitigate
//     in Phase 2. See 02-CONTEXT.md §D-15 for the full rationale.
//
// D-06: scrape visible tokens from DOM; hybrid seed-list first (Pitfall 8 Option C).
// D-07: no ?perf=1, no NEXT_PUBLIC_E2E, no revealAll short-circuit.
// D-10: single-sample hard-fail on revealMs, no median-of-N.
// D-11: retries: 1 for the whole spec (flake guard only).
// D-14: Axeptio consent dialog dismissed before the warm-up (see below).
// D-15: rttMs observability-only; revealMs remains the sacred CI gate.
//
// CAVEAT: WebKit-on-Linux is a necessary but not sufficient proxy for real iOS Safari.
// The budget passing here is a regression detector, not a guarantee for iPhone users.

import { test, expect } from './fixtures'
import type { APIRequestContext } from '@playwright/test'

test.describe.configure({ retries: 1 })

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

const SEED_WORDS = [
  'article', 'avec', 'pour', 'entre', 'dans', 'sans',
  'sous', 'plus', 'temps', 'partie', 'siècle',
]

// FIXME(v1.1-deferral): legacy daily-game spec — superseded by
// e2e/daily-game-new-ui.spec.ts which exercises the same flow on the
// new-design tree (the only daily render path post-flag-flip). The
// legacy `guess:fetch-end` performance mark this test waits for is
// not emitted by the new-design GuessInput pipeline, so the test
// hangs at line ~219. Survival/duel still render the legacy tree;
// rewriting this spec to target survival/duel paths is v1.2 scope.
test.fixme('plays today\'s daily article and meets sacred latency budgets', async ({ page }) => {
  await page.goto('/game')

  // -----------------------------------------------------------------------
  // Dismiss the Axeptio cookie-consent widget before anything else (D-14,
  // 2026-04-17). The widget is loaded via GTM (see src/app/layout.tsx
  // <GoogleTagManager>) on every fresh browser profile — in Playwright, each
  // test run uses a fresh storage state, so the widget is ALWAYS visible on
  // the first load. When active, Axeptio injects scripts that compete with
  // the /api/game/guess fetch for the main-thread JS budget, inflating
  // rttMs well above the 200ms sacred budget (observed 358ms on the first
  // measured iteration of prior runs). Real users dismiss the widget once
  // per device then never see it again, so measuring rttMs with it open is
  // not representative of product perf.
  //
  // The widget renders as a role="dialog" with primary action "OK pour moi"
  // (accept-all) in the full modal. A-B variants may surface different
  // labels; we try a prioritised selector list with short, bounded timeouts.
  // All attempts swallow errors via .catch(() => {}) so the test still works
  // if none of the variants match (e.g., GTM blocked, returning visitor
  // with stored consent, or Axeptio service unreachable).
  //
  // Implementation notes:
  //   - D-04 preserved: we dismiss the DISPLAY layer, not any data layer —
  //     the test still plays today's real daily article from prod Supabase.
  //   - addLocatorHandler as a safety net: if the widget re-appears later in
  //     the session (rare but possible), Playwright auto-dismisses it.
  //   - setTimes: 2 caps runaway dismiss loops; noWaitAfter: false preserves
  //     the default wait-until-hidden behaviour.
  // -----------------------------------------------------------------------
  const dismissConsent = async () => {
    // Try primary action labels in priority order. First match wins; others
    // no-op because the dialog is already gone.
    const labels = [
      'OK pour moi',
      'Accepter',
      'Accept all',
      'Tout accepter',
    ]
    for (const name of labels) {
      const btn = page.getByRole('button', { name }).first()
      const ok = await btn.click({ timeout: 2000 }).then(() => true).catch(() => false)
      if (ok) return
    }
    // Fallback: click the first button inside any role="dialog" whose
    // accessible name references consent / cookies / Axeptio.
    const dialog = page.getByRole('dialog').filter({
      hasText: /consent|cookie|axeptio|personnalisez/i,
    }).first()
    await dialog.getByRole('button').first().click({ timeout: 2000 }).catch(() => {})
  }

  // Register a handler so a re-appearing widget is auto-dismissed. The
  // trigger is ANY role="dialog" with consent-related text in the main frame.
  await page.addLocatorHandler(
    page.getByRole('dialog').filter({
      hasText: /consent|cookie|axeptio|personnalisez/i,
    }).first(),
    dismissConsent,
    { times: 2 },
  )

  // Proactive dismiss on first paint — don't wait for the widget to block a
  // future action. Give the GTM/Axeptio script up to 5s to surface.
  await page.waitForTimeout(500) // let GTM boot
  await dismissConsent()

  // Wait for the game UI to be interactive (guess input present). If the
  // widget is still up at this point, the addLocatorHandler above will
  // dismiss it when Playwright tries to interact with the input.
  const input = page.locator('input[placeholder*="mot" i], input[placeholder*="word" i]').first()
  await input.waitFor({ state: 'visible', timeout: 30_000 })

  // -----------------------------------------------------------------------
  // Warm-up guess (unmeasured). Establishes "warm" for the <200ms warm-budget
  // per D-08/D-09 clarification #3 (2026-04-17). Cold-boot costs on the FIRST
  // iteration — Next server cold start, Supabase connection-pool init, and
  // Wiktionary TLS handshake — are architectural and unrelated to product
  // perf. Excluding them from the gate is correct; this is NOT median-of-N
  // smoothing (D-10 preserved — every measured sample still hard-fails on
  // budget).
  //
  // We use a word the server will process fully but that will traverse the
  // full /api/game/guess → Wiktionary validation → Supabase path. Pick a
  // plainly-invalid nonce ("xzqw") that Wiktionary will reject — rejected
  // guesses still serialize through the HARD-01 queue exactly like a real
  // guess, so the warm-up touches the same network + server paths as a real
  // submission. A known stopword would NOT warm-up because the client
  // filters stopwords before submission. This nonce is not in SEED_WORDS so
  // it does not deplete the measured sequence.
  // -----------------------------------------------------------------------
  await input.fill('xzqw')
  await input.press('Enter')
  await page.waitForFunction(
    () => performance.getEntriesByName('guess:fetch-end').length > 0,
    null,
    { timeout: 10_000 },
  ).catch(() => {
    // Even if fetch-end never fires (e.g., client-side reject before submit),
    // continue — the measured loop will still benefit from JIT/process warm-up.
  })
  // Clear marks/measures so the measured loop starts with a clean slate.
  await page.evaluate(() => {
    performance.clearMarks()
    performance.clearMeasures()
  })
  // Clear the input field (some browsers retain the rejected value).
  await input.fill('')

  const maxGuesses = 60
  const tried: string[] = []
  let seedIdx = 0

  for (let i = 0; i < maxGuesses; i++) {
    const won = await page.locator('text=/Bravo|Well done/i').isVisible().catch(() => false)
    if (won) break

    // Pick a word: seed list first, then scrape revealed tokens for fresh candidates
    let word: string | null = null
    if (seedIdx < SEED_WORDS.length) {
      word = SEED_WORDS[seedIdx++]
      if (tried.includes(word)) continue
    } else {
      word = await page.evaluate((alreadyTried: string[]) => {
        const candidates = Array.from(document.querySelectorAll('span[data-word]'))
          .map(el => el.getAttribute('data-word') || '')
          .filter(w => w.length >= 4)
        for (const w of candidates) if (!alreadyTried.includes(w.toLowerCase())) return w
        return null
      }, tried)
    }

    if (!word) break

    tried.push(word.toLowerCase())

    // Clear marks before each guess so measure reads fresh values
    await page.evaluate(() => {
      performance.clearMarks()
      performance.clearMeasures()
    })

    await input.fill(word)
    await input.press('Enter')

    // Wait for both marks to exist
    await page.waitForFunction(
      () => performance.getEntriesByName('guess:reveal-painted').length > 0,
      null,
      { timeout: 2000 },
    ).catch(() => {
      // If no reveal-painted fires, this guess did not produce an optimistic flash
      // (e.g., stopword or word not in article). Skip the latency assertion for this iteration.
    })

    const hasReveal = await page.evaluate(
      () => performance.getEntriesByName('guess:reveal-painted').length > 0,
    )
    if (!hasReveal) continue

    await page.waitForFunction(
      () => performance.getEntriesByName('guess:fetch-end').length > 0,
      null,
      { timeout: 5000 },
    )

    const { revealMs, rttMs } = await page.evaluate(() => {
      performance.measure('guess:reveal', 'guess:enter', 'guess:reveal-painted')
      // rttMs measurement kept as-is per D-15 — still a real sample for forward
      // RUM / Sentry web-vitals integration, and surfaced per-iteration via the
      // console.log below so CI logs retain the observability signal.
      performance.measure('guess:rtt', 'guess:fetch-start', 'guess:fetch-end')
      const reveal = performance.getEntriesByName('guess:reveal').at(-1) as PerformanceMeasure | undefined
      const rtt = performance.getEntriesByName('guess:rtt').at(-1) as PerformanceMeasure | undefined
      return {
        revealMs: reveal?.duration ?? -1,
        rttMs: rtt?.duration ?? -1,
      }
    })

    // D-15: per-iteration observability log for rttMs. NOT an assertion. Appears in
    // Playwright CI stdout so regressions in the server round-trip are visible even
    // though they do not gate merges. If a pattern of rttMs regressions surfaces here
    // in future runs, raise it as a separate (non-CI-gate) investigation.
    console.log(`[e2e:perf] word="${word}" revealMs=${revealMs.toFixed(2)} rttMs=${rttMs.toFixed(2)} (rtt observability-only per D-15)`)

    // D-10: hard fail on any single sample over budget. Only revealMs gates merges
    // (the optimistic-reveal budget from PROJECT.md Core Value "<50ms visible").
    expect(revealMs, `optimistic reveal duration for "${word}"`).toBeLessThan(50)
  }

  // Final assertion: we reached the loop-exit condition (won or ran out of words).
  // The latency gate IS the phase; winning is secondary. No hard win assertion.
})

// ---------------------------------------------------------------------------
// UAT-P1-IDEMPOTENCY — Phase 6 Plan 02 Task 2.
//
// Purpose: exercise the server-side idempotency replay path end-to-end against
// the newly-live production public.idempotency_keys table. Confirms that two
// POSTs to /api/game/guess with the same idempotencyKey return byte-identical
// bodies AND that exactly ONE row is written to public.guesses (proving the
// second call replayed the cached response rather than re-running the handler).
//
// Preconditions:
//   - public.idempotency_keys table applied in prod (see
//     .planning/phases/06-tech-debt-closeout/06-02-MIGRATION-VERIFY.md).
//   - PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD / SUPABASE_ACCESS_TOKEN
//     env vars set (same precedent as duel-flow.spec.ts). Skipped gracefully
//     in their absence — CI is the authoritative environment.
//
// Isolation:
//   - afterAll DELETEs the game + guesses + idempotency_keys rows created by
//     this test, keyed on game_id — safe re-runs.
//   - Does NOT touch the sacred-latency test above (separate test(), fresh
//     page context).
//
// This test is additive only: the latency gate above is unchanged.
// ---------------------------------------------------------------------------

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

// Pick a known-benign word for the double-POST. We want a word Wiktionary will
// accept (not stopword-filtered by the client, not an invalid nonce) so the
// handler traverses the full commit() path. "test" is ASCII, validates in
// both fr + en Wiktionary, and is not a stopword in either language.
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
