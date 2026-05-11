// Phase 3 Plan 05 — MODE-05 resume-after-reload E2E.
// Phase 6 Plan 01 — MODE-05 cross-device resume (browser.newContext equality).
//
// Scope: start a Survival run from home, verify HUD renders at /game, reload the
// page and assert HUD still renders (cross-device resume round-trip via Supabase),
// then navigate back to home and assert the SurvivalCard shows Resume state.
// Phase 6 adds a second test that opens a FRESH browser context (no cookies/storage
// shared) and asserts the chain state (lives + chainLength) is byte-identical,
// plus exactly one open survival row exists in the DB (no fresh INSERT on resume).
//
// Credential strategy matches won-game fixture: test.skip() gracefully when
// PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD / SUPABASE_ACCESS_TOKEN absent.
// CI is the authoritative environment per Phase 2.1 Plan 03 precedent.

import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

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

// Extract "N" from the lives aria-label string, which takes the form
// "Vies restantes : N sur 3" (fr) or "Lives remaining: N of 3" (en).
// Returns NaN when the label is missing or malformed so callers fail loudly.
function parseLivesFromAriaLabel(label: string | null | undefined): number {
    if (!label) return NaN
    const match = label.match(/(\d+)\s*(?:sur|of)\s*\d+/i)
    return match ? Number(match[1]) : NaN
}

// Extract "N" from the chain badge status, which takes the form
// "Longueur de la chaîne : N articles" (fr) or "Chain length: N articles" (en).
function parseChainFromAriaLabel(label: string | null | undefined): number {
    if (!label) return NaN
    const match = label.match(/:\s*(\d+)\s*articles?/i)
    return match ? Number(match[1]) : NaN
}

async function countOpenSurvivalRuns(email: string): Promise<number> {
    const safe = email.replace(/'/g, "''")
    const result = await runSql(
        `SELECT COUNT(*)::int AS open_count FROM public.games
            WHERE mode = 'survival'
              AND completed_at IS NULL
              AND user_id = (SELECT id FROM auth.users WHERE email = '${safe}' LIMIT 1);`,
    ) as Array<{ open_count: number }>
    return Array.isArray(result) && result.length > 0 ? Number(result[0].open_count) : -1
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

    test('MODE-05 cross-device resume preserves chain state (Phase 6)', async ({ browser }) => {
        const email = process.env.PLAYWRIGHT_TEST_EMAIL
        const password = process.env.PLAYWRIGHT_TEST_PASSWORD
        if (!email || !password || !process.env.SUPABASE_ACCESS_TOKEN) {
            // LOUD-IN-ISOLATION (D-03b): when creds are present but one of the
            // three is missing in CI, skip — but the message names all three so
            // the auth stub gap surfaces loudly in CI logs.
            test.skip(
                true,
                'Set PLAYWRIGHT_TEST_EMAIL + PLAYWRIGHT_TEST_PASSWORD + SUPABASE_ACCESS_TOKEN to run MODE-05 cross-device resume E2E',
            )
            return
        }

        await clearExistingSurvivalRuns(email)

        // ─── Context A: device-1, start + play enough to advance the HUD ────
        const ctxA = await browser.newContext()
        const pageA = await ctxA.newPage()
        await loginViaUi(pageA, email, password)
        await pageA.goto(`${BASE_URL}/`)
        const startBtn = pageA.getByRole('button', { name: /Lancer un Survival|Start Survival/ }).first()
        await expect(startBtn).toBeVisible({ timeout: 15_000 })
        await startBtn.click()
        await expect(pageA).toHaveURL(/mode=survival/, { timeout: 15_000 })

        const livesStatusA = pageA.getByRole('status', { name: /Vies restantes|Lives remaining/ }).first()
        await expect(livesStatusA).toBeVisible({ timeout: 15_000 })
        // Give the ChainBadge a chance to hydrate; it renders in the HUD row.
        const chainBadgeA = pageA.getByRole('status', { name: /Longueur de la chaîne|Chain length/ }).first()
        await expect(chainBadgeA).toBeVisible({ timeout: 15_000 })

        const livesLabelBefore = await livesStatusA.getAttribute('aria-label')
        const chainLabelBefore = await chainBadgeA.getAttribute('aria-label')
        const livesBefore = parseLivesFromAriaLabel(livesLabelBefore)
        const chainBefore = parseChainFromAriaLabel(chainLabelBefore)
        // Loud-in-isolation guard: if either aria-label shape changes, this
        // test must fail explicitly rather than silently pass with NaN===NaN.
        expect(Number.isFinite(livesBefore)).toBe(true)
        expect(Number.isFinite(chainBefore)).toBe(true)

        // Sanity: exactly one open row exists for this user after Start.
        expect(await countOpenSurvivalRuns(email)).toBe(1)

        // ─── Context B: fresh cookie jar ≡ second device ─────────────────────
        const ctxB = await browser.newContext()
        const pageB = await ctxB.newPage()
        await loginViaUi(pageB, email, password)

        // Land on home — SurvivalCard must offer Resume (not Start).
        await pageB.goto(`${BASE_URL}/`)
        const resumeBtn = pageB.getByRole('button', { name: /Reprendre|Resume/ }).first()
        await expect(resumeBtn).toBeVisible({ timeout: 15_000 })
        await resumeBtn.click()

        await expect(pageB).toHaveURL(/mode=survival/, { timeout: 15_000 })
        const livesStatusB = pageB.getByRole('status', { name: /Vies restantes|Lives remaining/ }).first()
        const chainBadgeB = pageB.getByRole('status', { name: /Longueur de la chaîne|Chain length/ }).first()
        await expect(livesStatusB).toBeVisible({ timeout: 15_000 })
        await expect(chainBadgeB).toBeVisible({ timeout: 15_000 })

        const livesLabelAfter = await livesStatusB.getAttribute('aria-label')
        const chainLabelAfter = await chainBadgeB.getAttribute('aria-label')
        const livesRemainingAfter = parseLivesFromAriaLabel(livesLabelAfter)
        const chainLengthAfter = parseChainFromAriaLabel(chainLabelAfter)

        // Core MODE-05 assertion: state is byte-identical across contexts.
        expect(livesRemainingAfter).toBe(livesBefore)
        expect(chainLengthAfter).toBe(chainBefore)

        // Core no-INSERT-on-resume assertion: still exactly one open row.
        expect(await countOpenSurvivalRuns(email)).toBe(1)

        await ctxB.close()
        await ctxA.close()

        // Cleanup — repeatable test runs. (Safe: only touches THIS user's rows.)
        await clearExistingSurvivalRuns(email)
    })
})
