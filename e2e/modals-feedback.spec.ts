// Phase 12 / Plan 01 — Playwright spec for MOD-03 (Feedback modal).
//
// Phase 19 / Plan 02 — un-fixme'd the submit-body capture test. The
// original used a closure-captured `captured` variable populated inside
// a `page.route` handler then asserted on it after a `waitForTimeout`,
// which raced: the assertion ran before the handler closed (D-03).
// Rewritten with `page.waitForRequest` hoisted BEFORE the submit click
// and awaited after, the idiomatic Playwright pattern for deterministic
// request-body capture. /api/feedback is also mocked via route.fulfill
// to suppress real Resend sends in CI (RESEARCH Open Q2).
//
// Locked decisions covered:
//   - D-13 (categories: bug / suggestion / article / other)
//   - D-14 (message required, min 30 chars; submit blocked under threshold)
//   - D-15 (entry point = burger menu only when WF_NEW_DESIGN on)
//   - D-16 (auto-prefill metadata appended to message body, not visible)
//   - D-17 (POST /api/feedback schema unchanged — only message + pageId)

import { test, expect } from './fixtures'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

async function setNewDesignFlag(context: import('@playwright/test').BrowserContext) {
  await context.clearCookies()
  await context.addCookies([{
    name: 'wf_new_design',
    value: '1',
    url: BASE_URL,
  }])
}

async function dismissOnboardingIfPresent(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    try { localStorage.setItem('wf_onboarded_v1', '1') } catch {}
  })
}

test.describe('MOD-03 Feedback modal', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  // Axeptio dismissal is shared via e2e/fixtures.ts (Phase 19 / Plan 01).

  test('opens from burger menu Feedback item', async ({ page, context }) => {
    await setNewDesignFlag(context)
    await page.goto('/game?wf_new_design=1&lang=fr')
    await dismissOnboardingIfPresent(page)
    await page.reload()

    // D-15: feedback entry is the burger drawer item.
    await page.getByRole('button', { name: /menu|burger/i }).first().click()
    await page.getByRole('button', { name: /signaler|feedback|send feedback/i }).click()

    await expect(page.locator('[data-testid="feedback-modal"]')).toBeVisible({ timeout: 5_000 })
  })

  test('submit posts message + pageId to /api/feedback with metadata footer in body', async ({ page, context }) => {
    await setNewDesignFlag(context)

    // Mock the /api/feedback response BEFORE navigation to suppress real
    // Resend email sends in CI (Open Q2). route.fulfill intercepts AFTER
    // the request hits the network layer, so page.waitForRequest still
    // fires on the same POST — the two are complementary, not exclusive.
    await context.route('**/api/feedback', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/game?wf_new_design=1&lang=fr')
    await dismissOnboardingIfPresent(page)
    await page.reload()

    // Open modal via burger.
    await page.getByRole('button', { name: /menu|burger/i }).first().click()
    await page.getByRole('button', { name: /signaler|feedback|send feedback/i }).click()
    await expect(page.locator('[data-testid="feedback-modal"]')).toBeVisible({ timeout: 5_000 })

    // Type a >30-char message (above D-14 threshold).
    await page.locator('[data-testid="feedback-textarea"]')
      .fill('Bug: tokens flicker on iOS Safari sometimes')

    // Select bug category.
    await page.locator('[data-testid="feedback-cat-bug"]').click()

    // D-03 + RESEARCH Pattern 2: start waiting BEFORE the click so the
    // listener cannot miss the request. The submit click triggers a
    // fire-and-forget fetch inside FeedbackModal.handleSubmit (see
    // src/components/game/new/modals/FeedbackModal.tsx:131-135).
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/feedback') && req.method() === 'POST',
      { timeout: 5_000 },
    )
    await page.locator('[data-testid="feedback-submit"]').click()
    const request = await requestPromise

    const body = request.postDataJSON() as { message: string; pageId: unknown }

    // D-17: schema unchanged — body has ONLY `message` and `pageId` keys.
    expect(Object.keys(body).sort()).toEqual(['message', 'pageId'].sort())

    // User text preserved at the top of the message.
    expect(body.message).toContain('Bug: tokens flicker on iOS Safari sometimes')

    // D-16: metadata embedded in the message string as a footer block
    // (constructed at FeedbackModal.tsx:110-119).
    expect(body.message).toContain('[meta] category: bug')
    expect(body.message).toContain('[meta] lang:')
    expect(body.message).toContain('[meta] ua:')
  })

  test('submit blocked when message under 30 chars', async ({ page, context }) => {
    await setNewDesignFlag(context)

    // Counter for /api/feedback POSTs — must remain 0.
    let postCount = 0
    await page.route('**/api/feedback', async route => {
      if (route.request().method() === 'POST') postCount += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    })

    await page.goto('/game?wf_new_design=1&lang=fr')
    await dismissOnboardingIfPresent(page)
    await page.reload()

    await page.getByRole('button', { name: /menu|burger/i }).first().click()
    await page.getByRole('button', { name: /signaler|feedback|send feedback/i }).click()
    await expect(page.locator('[data-testid="feedback-modal"]')).toBeVisible({ timeout: 5_000 })

    // Only 10 chars — below D-14 threshold (30).
    await page.locator('[data-testid="feedback-textarea"]').fill('too short.')

    const submit = page.locator('[data-testid="feedback-submit"]')
    // Either the submit is disabled, or clicking it triggers no POST.
    const isDisabled = await submit.isDisabled().catch(() => false)
    if (!isDisabled) {
      await submit.click().catch(() => {})
      await page.waitForTimeout(500)
    }

    expect(postCount).toBe(0)
  })
})
