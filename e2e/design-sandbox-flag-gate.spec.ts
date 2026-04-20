// Phase 7 Plan 05 — DS-05 flag-gate E2E per D-13.
//
// Scope: prove the WF_NEW_DESIGN plumbing works end-to-end at the server
// component boundary. The /design-sandbox route is gated by
// isNewDesignEnabled() (server helper) which reads WF_NEW_DESIGN env first
// and wf_new_design cookie as fallback (see src/lib/feature-flags.ts).
//
// Env precondition: WF_NEW_DESIGN must be unset or '0' in the Playwright
// test process so the 404 path is deterministic. The second test uses the
// ?wf_new_design=1 query-param override (D-11a): proxy.ts same-request
// writes the cookie to '1' via request.cookies.set(), and the server
// component's await cookies() sees '1' on this exact request. This exercises
// the full Plan 07-04 bridge + Plan 07-05 sandbox integration.
//
// Note: seeding the cookie directly via context.addCookies() is NOT
// sufficient to reach 200 when env is off — proxy.ts (Plan 07-04)
// reconciles the cookie against env on every request and would overwrite a
// stale '1' cookie with '0' before the server component reads it. The
// query-param path is the designed dev/staging override (D-11a).

import { test, expect } from '@playwright/test'

test.describe('design-sandbox flag gate', () => {
  test('404 when wf_new_design cookie is absent and env is off', async ({ page, context }) => {
    await context.clearCookies()
    const response = await page.goto('/design-sandbox')
    expect(response?.status()).toBe(404)
  })

  test('200 when ?wf_new_design=1 query override is set', async ({ page, context }) => {
    await context.clearCookies()
    const response = await page.goto('/design-sandbox?wf_new_design=1')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Design Sandbox', level: 1 })).toBeVisible()
    await expect(page.getByTestId('sandbox-swatches')).toBeVisible()
    await expect(page.getByTestId('sandbox-icons')).toBeVisible()
  })
})
