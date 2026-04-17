// E2E: plays today's real daily article from prod Supabase.
//
// Sacred-metric assertions per iteration:
//   - performance.measure('guess:reveal', 'guess:enter', 'guess:reveal-painted') < 50ms
//   - performance.measure('guess:rtt', 'guess:fetch-start', 'guess:fetch-end') < 200ms
//
// D-06: scrape visible tokens from DOM; hybrid seed-list first (Pitfall 8 Option C).
// D-07: no ?perf=1, no NEXT_PUBLIC_E2E, no revealAll short-circuit.
// D-10: single-sample hard-fail, no median-of-N.
// D-11: retries: 1 for the whole spec (flake guard only).
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

  // Wait for the game UI to be interactive (guess input present)
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
      performance.measure('guess:rtt', 'guess:fetch-start', 'guess:fetch-end')
      const reveal = performance.getEntriesByName('guess:reveal').at(-1) as PerformanceMeasure | undefined
      const rtt = performance.getEntriesByName('guess:rtt').at(-1) as PerformanceMeasure | undefined
      return {
        revealMs: reveal?.duration ?? -1,
        rttMs: rtt?.duration ?? -1,
      }
    })

    // D-10: hard fail on any single sample over budget
    expect(revealMs, `optimistic reveal duration for "${word}"`).toBeLessThan(50)
    expect(rttMs, `server RTT for "${word}"`).toBeLessThan(200)
  }

  // Final assertion: we reached the loop-exit condition (won or ran out of words).
  // The latency gate IS the phase; winning is secondary. No hard win assertion.
})
