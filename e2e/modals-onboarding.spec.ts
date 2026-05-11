// Phase 12 / Plan 01 — Playwright spec for MOD-01 (Onboarding modal).
//
// Plan 19-03 rewrite (2026-05-11): Phase-13 removed the first-visit
// auto-show on /game (the tutorial now lives on the home page).
// Desktop has no overflow-menu entry (NewDesignHeader.tsx:136 is
// `isMobile`-gated), so the 3 originally-desktop tests were rewritten
// to drive the mobile burger ("Comment jouer" / "How to play") entry
// point — the canonical path for re-opening the onboarding modal.
//
// Locked decisions covered: D-01 (4 steps), D-02 (skip on every step),
// D-03 (burger re-trigger does NOT re-arm wf_onboarded_v1 gate),
// D-05 (EN/FR aware), D-06 (first-visit gate via wf_onboarded_v1).
//
// Cookie/query setup pattern is copied verbatim from
// e2e/daily-game-new-ui.spec.ts:36-47. Axeptio dismissal is handled
// by the shared fixture (e2e/fixtures.ts, Plan 19-01).

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

test.describe('MOD-01 Onboarding modal — opens via burger', () => {
  // Mobile viewport: the burger entry exists only in MobileShell
  // (NewDesignHeader.tsx:136 gates the menu button on `isMobile`).
  test.use({ viewport: { width: 375, height: 812 } })

  test('opens via burger when wf_onboarded_v1 absent', async ({ page, context }) => {
    await setNewDesignFlag(context)
    await page.goto('/game?wf_new_design=1&lang=fr')
    await page.evaluate(() => {
      try { localStorage.removeItem('wf_onboarded_v1') } catch {}
    })

    const modal = page.locator('[data-testid="onboarding-modal"]')
    // Auto-show is gone post-Phase 13 — modal must not appear on its own.
    await expect(modal).not.toBeVisible({ timeout: 3_000 })

    await page.getByRole('button', { name: /open menu|menu|burger/i }).first().click()
    await page.locator('[data-testid="burger-howtoplay"]').click()

    await expect(modal).toBeVisible({ timeout: 5_000 })

    // D-01: exactly 4 progress dots.
    await expect(page.locator('[data-testid="onb-dot"]')).toHaveCount(4)
  })

  test('skip button visible on all 4 steps', async ({ page, context }) => {
    await setNewDesignFlag(context)
    await page.goto('/game?wf_new_design=1&lang=fr')
    await page.evaluate(() => {
      try { localStorage.removeItem('wf_onboarded_v1') } catch {}
    })

    await page.getByRole('button', { name: /open menu|menu|burger/i }).first().click()
    await page.locator('[data-testid="burger-howtoplay"]').click()

    const modal = page.locator('[data-testid="onboarding-modal"]')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // D-02: skip visible on every step.
    for (let stepIdx = 0; stepIdx < 4; stepIdx++) {
      await expect(page.locator('[data-testid="onb-skip"]')).toBeVisible()
      if (stepIdx < 3) {
        await page.locator('[data-testid="onb-next"]').click()
      }
    }
  })

  test('renders EN copy when lang=en', async ({ page, context }) => {
    // D-05: EN/FR aware. Pass condition: modal text contains "Wikipedia"
    // (Goal step EN) and not the FR-accented "Wikipédia".
    await setNewDesignFlag(context)
    await page.goto('/game?wf_new_design=1&lang=en')
    await page.evaluate(() => {
      try { localStorage.removeItem('wf_onboarded_v1') } catch {}
    })

    await page.getByRole('button', { name: /open menu|menu|burger/i }).first().click()
    await page.locator('[data-testid="burger-howtoplay"]').click()

    const modal = page.locator('[data-testid="onboarding-modal"]')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    const text = (await modal.innerText()).toLowerCase()
    expect(text).toContain('wikipedia')
    expect(text).not.toContain('wikipédia')
  })
})

test.describe('MOD-01 Onboarding modal — mobile burger re-trigger', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('does not auto-show when wf_onboarded_v1 set; burger re-trigger does NOT re-arm gate', async ({ page, context }) => {
    await setNewDesignFlag(context)
    await page.goto('/game?wf_new_design=1&lang=fr')
    await page.evaluate(() => {
      try { localStorage.setItem('wf_onboarded_v1', '1') } catch {}
    })
    await page.reload()

    const modal = page.locator('[data-testid="onboarding-modal"]')
    await expect(modal).not.toBeVisible({ timeout: 5_000 })

    // Open burger drawer + tap "Comment jouer" / "How to play".
    await page.getByRole('button', { name: /menu|burger/i }).first().click()
    await page.getByRole('button', { name: /comment jouer|how to play/i }).click()

    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Close modal (skip button works on every step).
    await page.locator('[data-testid="onb-skip"]').click()

    // D-03: menu-trigger close MUST NOT touch the gate. wf_onboarded_v1
    // still equals '1' after dismiss.
    const flagAfter = await page.evaluate(() => {
      try { return localStorage.getItem('wf_onboarded_v1') } catch { return null }
    })
    expect(flagAfter).toBe('1')
  })
})
