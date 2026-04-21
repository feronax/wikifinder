// E2E (WF_NEW_DESIGN flag-on variant): clones daily-game.spec.ts; exercises the
// new-UI render path (plans 09-01..09-06). D-13 clone; D-14 both specs gate merges.
//
// E2E (flag-on): plays today's real daily article through the NEW UI tree.
//
// Sacred-metric assertion per iteration (the CI gate):
//   - performance.measure('guess:reveal', 'guess:enter', 'guess:reveal-painted') < 50ms
//     against the new-UI render pipeline (ArticleBody emits reveal-painted via
//     useLayoutEffect; GuessInput emits guess:enter inside the sacred submit path).
//
// Observability-only (measured + logged, NOT asserted):
//   - rttMs stays observability-only per D-15. The new-UI variant's GuessInput
//     fires a fire-and-forget POST (no await), so guess:fetch-start / fetch-end
//     marks are NOT emitted on the new path. Iteration logs revealMs only.
//
// D-06: scrape visible tokens from DOM; hybrid seed-list first (Pitfall 8 Option C).
// D-10: single-sample hard-fail on revealMs, no median-of-N.
// D-11: retries: 1 for the whole spec (flake guard only).
// D-13/D-14: flag ON via cookie + ?wf_new_design=1 query; both specs (legacy + new)
//            must pass for merge.
//
// CAVEAT: WebKit-on-Linux is a necessary but not sufficient proxy for real iOS Safari.
// The budget passing here is a regression detector, not a guarantee for iPhone users.

import { test, expect } from '@playwright/test'

test.describe.configure({ retries: 1 })

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

const SEED_WORDS = [
  'article', 'avec', 'pour', 'entre', 'dans', 'sans',
  'sous', 'plus', 'temps', 'partie', 'siècle',
]

test('plays today daily (NEW UI) — revealMs < 50ms', async ({ page, context }) => {
  // D-13: force the new-UI flag ON for this spec via cookie + ?wf_new_design=1
  // (Phase 7 proxy.ts query-param bridge writes the cookie same-request).
  // Pattern matches design-sandbox-flag-gate.spec.ts.
  await context.clearCookies()
  await context.addCookies([{
    name: 'wf_new_design',
    value: '1',
    url: BASE_URL,
  }])

  await page.goto('/game?wf_new_design=1')

  // Dismiss Axeptio consent widget (same pattern as legacy spec).
  const dismissConsent = async () => {
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
    const dialog = page.getByRole('dialog').filter({
      hasText: /consent|cookie|axeptio|personnalisez/i,
    }).first()
    await dialog.getByRole('button').first().click({ timeout: 2000 }).catch(() => {})
  }

  await page.addLocatorHandler(
    page.getByRole('dialog').filter({
      hasText: /consent|cookie|axeptio|personnalisez/i,
    }).first(),
    dismissConsent,
    { times: 2 },
  )

  await page.waitForTimeout(500)
  await dismissConsent()

  // Wait for the new-UI guess input (placeholder is "Tapez un mot…" / "Type a word…").
  const input = page.locator('input[placeholder*="mot" i], input[placeholder*="word" i]').first()
  await input.waitFor({ state: 'visible', timeout: 30_000 })

  // Warm-up guess (unmeasured) — same rationale as legacy spec.
  await input.fill('xzqw')
  await input.press('Enter')
  // The new UI fires a fire-and-forget POST so we cannot wait on fetch-end.
  // A short idle wait lets any first-paint JIT / hash-warmup settle.
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    performance.clearMarks()
    performance.clearMeasures()
  })
  await input.fill('')

  const maxGuesses = 60
  const tried: string[] = []
  let seedIdx = 0

  for (let i = 0; i < maxGuesses; i++) {
    const won = await page.locator('text=/Bravo|Well done|Titre trouvé|Title found/i').isVisible().catch(() => false)
    if (won) break

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

    await page.evaluate(() => {
      performance.clearMarks()
      performance.clearMeasures()
    })

    await input.fill(word)
    await input.press('Enter')

    await page.waitForFunction(
      () => performance.getEntriesByName('guess:reveal-painted').length > 0,
      null,
      { timeout: 2000 },
    ).catch(() => {
      // No reveal-painted fires if the guess did not produce an optimistic flash
      // (stopword, not in article, duplicate). Skip latency assertion for this iter.
    })

    const hasReveal = await page.evaluate(
      () => performance.getEntriesByName('guess:reveal-painted').length > 0,
    )
    if (!hasReveal) continue

    const { revealMs } = await page.evaluate(() => {
      performance.measure('guess:reveal', 'guess:enter', 'guess:reveal-painted')
      const reveal = performance.getEntriesByName('guess:reveal').at(-1) as PerformanceMeasure | undefined
      return { revealMs: reveal?.duration ?? -1 }
    })

    // Per-iteration observability log (NEW UI variant).
    console.log(`[e2e:perf][new-ui] word="${word}" revealMs=${revealMs.toFixed(2)} (<50ms gate)`)

    // D-10: hard fail on any single sample over budget. Only revealMs gates merges.
    expect(revealMs, `(NEW UI) optimistic reveal duration for "${word}"`).toBeLessThan(50)
  }
})
