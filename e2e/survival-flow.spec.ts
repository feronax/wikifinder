// Phase 3 Plan 05 — MODE-05 resume-after-reload E2E.
//
// Scope: start a Survival run from home, verify HUD renders at /game, reload the
// page and assert HUD still renders (cross-device resume round-trip via Supabase),
// then navigate back to home and assert the SurvivalCard shows Resume state.
//
// Credential strategy matches won-game fixture: test.skip() gracefully when
// PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD / SUPABASE_ACCESS_TOKEN absent.
// CI is the authoritative environment per Phase 2.1 Plan 03 precedent.

import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const SUPABASE_URL = 'https://api.supabase.com/v1/projects/nkmrrvuijffhtmrysejm/database/query'

async function runSql(query: string): Promise<unknown> {
    const pat = process.env.SUPABASE_ACCESS_TOKEN
    if (!pat) throw new Error('SUPABASE_ACCESS_TOKEN not set in env')
    const res = await fetch(SUPABASE_URL, {
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

async function clearExistingSurvivalRuns(email: string): Promise<void> {
    // Drop any in-progress survival runs for the test user so the home-card
    // starts in Idle state and MODE-05 assertion is deterministic.
    const safe = email.replace(/'/g, "''")
    await runSql(
        `DELETE FROM public.games
            WHERE mode = 'survival'
              AND completed_at IS NULL
              AND user_id = (SELECT id FROM auth.users WHERE email = '${safe}' LIMIT 1);`,
    )
}

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
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
    await page.getByRole('button', { name: /se connecter|sign in|log in|connexion/i }).first().click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
}

test.describe('MODE-05: survival run resumes after reload (Phase 3 Plan 05)', () => {
    test('start → reload → home-resume', async ({ page }) => {
        const email = process.env.PLAYWRIGHT_TEST_EMAIL
        const password = process.env.PLAYWRIGHT_TEST_PASSWORD
        if (!email || !password || !process.env.SUPABASE_ACCESS_TOKEN) {
            test.skip(
                true,
                'Set PLAYWRIGHT_TEST_EMAIL + PLAYWRIGHT_TEST_PASSWORD + SUPABASE_ACCESS_TOKEN to run survival-flow E2E',
            )
            return
        }

        await clearExistingSurvivalRuns(email)
        await loginViaUi(page, email, password)

        // Landing: SurvivalCard should render in Idle state with Start CTA.
        await page.goto(`${BASE_URL}/`)
        const startBtn = page.getByRole('button', { name: /Lancer un Survival|Start Survival/ }).first()
        await expect(startBtn).toBeVisible({ timeout: 15_000 })
        await startBtn.click()

        // Verify /game?mode=survival and HUD lives status role is visible.
        await expect(page).toHaveURL(/mode=survival/, { timeout: 15_000 })
        const livesStatus = page.getByRole('status', { name: /Vies restantes|Lives remaining/ }).first()
        await expect(livesStatus).toBeVisible({ timeout: 15_000 })

        // Reload — survival state must restore (server-persisted mode_config).
        await page.reload()
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
        await expect(livesStatus).toBeVisible({ timeout: 15_000 })

        // Back to home: SurvivalCard must now be in Resume state.
        await page.goto(`${BASE_URL}/`)
        const resumeBtn = page.getByRole('button', { name: /Reprendre|Resume/ }).first()
        await expect(resumeBtn).toBeVisible({ timeout: 15_000 })
    })
})
