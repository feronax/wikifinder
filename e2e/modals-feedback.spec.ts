// Phase 12 / Plan 01 — RED Playwright spec for MOD-03 (Feedback modal).
//
// These tests are RED until Plan 03 ships the new FeedbackModal and
// Plan 05 wires it into the BurgerDrawer. The data-testid contract
// registered here ("feedback-modal", "feedback-textarea",
// "feedback-cat-bug", "feedback-cat-suggestion", "feedback-cat-article",
// "feedback-cat-other", "feedback-submit") is binding for downstream plans.
//
// Locked decisions covered:
//   - D-13 (categories: bug / suggestion / article / other)
//   - D-14 (message required, min 30 chars; submit blocked under threshold)
//   - D-15 (entry point = burger menu only when WF_NEW_DESIGN on)
//   - D-16 (auto-prefill metadata appended to message body, not visible)
//   - D-17 (POST /api/feedback schema unchanged — only message + pageId)
//
// Network intercept pattern: page.route('**/api/feedback', ...) with the
// route handler closing over a captured-body variable so the test can
// assert request body content AFTER the click.

import { test, expect } from '@playwright/test'

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

    // Capture the POST body the modal sends.
    let captured: { message?: unknown; pageId?: unknown; keys?: string[] } | null = null
    await page.route('**/api/feedback', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as Record<string, unknown>
        captured = {
          message: body?.message,
          pageId: body?.pageId,
          keys: Object.keys(body ?? {}),
        }
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

    // Type a 40-char message (above 30-char min).
    await page.locator('[data-testid="feedback-textarea"]')
      .fill('Bug: tokens flicker on iOS Safari sometimes')

    // Select bug category.
    await page.locator('[data-testid="feedback-cat-bug"]').click()

    // Submit.
    await page.locator('[data-testid="feedback-submit"]').click()

    // Wait for fetch to fire.
    await page.waitForTimeout(500)

    expect(captured).not.toBeNull()
    const cap = captured as unknown as { message: string; pageId: unknown; keys: string[] }

    // D-17: schema unchanged — body has ONLY `message` and `pageId` keys.
    expect(cap.keys.sort()).toEqual(['message', 'pageId'].sort())

    // D-16: metadata embedded in the message string as a footer block.
    expect(cap.message).toContain('[meta] category: bug')
    expect(cap.message).toContain('[meta] lang:')
    expect(cap.message).toContain('[meta] ua:')

    // User text preserved at the top of the message.
    expect(cap.message).toContain('Bug: tokens flicker on iOS Safari sometimes')
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
