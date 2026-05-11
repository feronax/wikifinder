// Phase 12 / Plan 01 — RED Playwright spec for MOD-01 (Onboarding modal).
//
// These tests are intentionally RED until Plans 02 + 05 ship the new
// OnboardingModal component and wire it into app/game/page.tsx +
// MobileShell BurgerDrawer. The data-testid contract registered here
// ("onboarding-modal", "onb-dot", "onb-skip", "onb-next", "onb-back",
// "onb-step-{0..3}") is binding for downstream plans.
//
// Locked decisions covered: D-01 (4 steps), D-02 (skip on every step),
// D-03 (burger re-trigger does NOT re-arm wf_onboarded_v1 gate),
// D-05 (EN/FR aware), D-06 (first-visit gate via wf_onboarded_v1).
//
// Cookie/query setup pattern is copied verbatim from
// e2e/daily-game-new-ui.spec.ts:36-47.

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

// FIXME(v1.1-deferral): Phase-13 PR removed the first-visit auto-show
// (the same tutorial now lives on the home page; popping a modal on
// /game was redundant). The mobile burger re-trigger test below still
// passes against the manual-open path. The 3 desktop auto-show tests
// are fixme'd until they're rewritten to drive the burger menu instead.
test.describe('MOD-01 Onboarding modal — desktop', () => {
  test.fixme('auto-shows on first visit when wf_onboarded_v1 absent', async ({ page, context }) => {
    await setNewDesignFlag(context)
    await page.goto('/game?wf_new_design=1&lang=fr')
    await page.evaluate(() => {
      try { localStorage.removeItem('wf_onboarded_v1') } catch {}
    })
    // Reload so the auto-show effect re-runs after the gate is cleared.
    await page.reload()

    const modal = page.locator('[data-testid="onboarding-modal"]')
    await expect(modal).toBeVisible({ timeout: 10_000 })

    // D-01: exactly 4 progress dots.
    await expect(page.locator('[data-testid="onb-dot"]')).toHaveCount(4)
  })

  test.fixme('skip button visible on all 4 steps', async ({ page, context }) => {
    await setNewDesignFlag(context)
    await page.goto('/game?wf_new_design=1&lang=fr')
    await page.evaluate(() => {
      try { localStorage.removeItem('wf_onboarded_v1') } catch {}
    })
    await page.reload()

    const modal = page.locator('[data-testid="onboarding-modal"]')
    await expect(modal).toBeVisible({ timeout: 10_000 })

    // D-02: skip visible on every step.
    for (let stepIdx = 0; stepIdx < 4; stepIdx++) {
      await expect(page.locator('[data-testid="onb-skip"]')).toBeVisible()
      await expect(page.getByRole('button', { name: /passer|skip/i })).toBeVisible()
      if (stepIdx < 3) {
        await page.locator('[data-testid="onb-next"]').click()
      }
    }
  })

  test.fixme('renders EN copy when lang=en', async ({ page, context }) => {
    // D-05: EN/FR aware. Pass condition: modal text contains "Wikipedia"
    // (Goal step EN) and not the FR-accented "Wikipédia".
    await setNewDesignFlag(context)
    await page.goto('/game?wf_new_design=1&lang=en')
    await page.evaluate(() => {
      try { localStorage.removeItem('wf_onboarded_v1') } catch {}
    })
    await page.reload()

    const modal = page.locator('[data-testid="onboarding-modal"]')
    await expect(modal).toBeVisible({ timeout: 10_000 })

    const text = (await modal.innerText()).toLowerCase()
    expect(text).toContain('wikipedia')
    expect(text).not.toContain('wikipédia')
  })
})

test.describe('MOD-01 Onboarding modal — mobile burger re-trigger', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  // See modals-feedback.spec.ts for context: Axeptio cookie banner
  // intercepts pointer events on Vercel preview. The script loads
  // indirectly via GTM so a route block alone is insufficient — install
  // a MutationObserver that removes the overlay as it mounts.
  test.beforeEach(async ({ page, context }) => {
    await context.route(/axept(?:io)?\.(?:io|eu|com)/i, (route) => route.abort())
    await page.addInitScript(() => {
      const sweep = () => {
        document
          .querySelectorAll('#axeptio_overlay, .axeptio_mount, [class*="axept"]')
          .forEach((el) => el.remove())
      }
      const observer = new MutationObserver(sweep)
      const start = () => {
        sweep()
        observer.observe(document.documentElement, { childList: true, subtree: true })
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true })
      } else {
        start()
      }
    })
  })

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
