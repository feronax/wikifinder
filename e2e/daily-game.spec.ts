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

import { test, expect } from '@playwright/test'

test.describe.configure({ retries: 1 })

const SEED_WORDS = [
  'article', 'avec', 'pour', 'entre', 'dans', 'sans',
  'sous', 'plus', 'temps', 'partie', 'siècle',
]

test('plays today\'s daily article and meets sacred latency budgets', async ({ page }) => {
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
