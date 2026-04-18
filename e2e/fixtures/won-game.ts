// Phase 2.1 Plan 03: shared fixture for SC-2 (won-game-restore) + SC-3 (results-score).
//
// Two specs consume this fixture in separate files per D-03b (each regression must
// fail loud in isolation). The fixture guarantees that, by the time the test body
// runs, there is EXACTLY ONE completed `games` row for the authenticated test user
// + today's daily page + the requested lang, so navigating to /game exercises the
// won-game restore path at api/game/start/route.ts:21 and the hydration branch at
// app/game/page.tsx:131.
//
// CREDENTIAL STRATEGY (plan-locked):
//   The fixture reads PLAYWRIGHT_TEST_EMAIL + PLAYWRIGHT_TEST_PASSWORD from env.
//   If either is absent, we test.skip() with a clear instruction. This is the
//   plan-mandated behavior so CI can run without these tests when the secrets
//   are not configured, and developers can opt in locally by setting them.
//
// SEED STRATEGY:
//   We drive the seed through the Supabase Management API using SUPABASE_ACCESS_TOKEN
//   (the same PAT used by Phase 2.1's investigation + fix plans). The fixture:
//     1. Resolves the user's auth.users UUID by email (service-role read).
//     2. Resolves today's daily page UUID via a direct HTTP hit to /api/game/today.
//     3. Idempotently upserts a completed `games` row for (user, page, lang).
//   The new UNIQUE(user_id, page_id, lang) constraint from the 2026-04-18 dedupe
//   migration guarantees the upsert never duplicates.

import { test as base, expect, type Page } from '@playwright/test'

type Fixtures = {
    wonGamePage: Page
}

const SUPABASE_URL = 'https://api.supabase.com/v1/projects/nkmrrvuijffhtmrysejm/database/query'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const TEST_LANG: 'fr' | 'en' = (process.env.PLAYWRIGHT_TEST_LANG as 'fr' | 'en') || 'fr'

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

async function resolveUserId(email: string): Promise<string> {
    const safe = email.replace(/'/g, "''")
    const rows = (await runSql(
        `SELECT id FROM auth.users WHERE email = '${safe}' LIMIT 1;`,
    )) as Array<{ id: string }>
    if (!rows || rows.length === 0) throw new Error(`Test user not found for email: ${email}`)
    return rows[0].id
}

async function resolveTodayPageId(lang: 'fr' | 'en'): Promise<string> {
    const rows = (await runSql(
        `SELECT id FROM public.pages WHERE lang = '${lang}' ORDER BY date DESC LIMIT 1;`,
    )) as Array<{ id: string }>
    if (!rows || rows.length === 0) throw new Error(`No daily page row for lang=${lang}`)
    return rows[0].id
}

async function seedWonGame(userId: string, pageId: string, lang: 'fr' | 'en'): Promise<void> {
    // Idempotent upsert. Relies on UNIQUE(user_id, page_id, lang) from the
    // 2026-04-18 dedupe migration. guess_count=5 is a reasonable non-zero
    // win (score = calculateScore(5, true) = 5000).
    const query = `
        INSERT INTO public.games
            (user_id, page_id, lang, guess_count, completed, started_at, completed_at, duration_seconds)
        VALUES
            ('${userId}', '${pageId}', '${lang}', 5, true, now() - interval '2 minutes', now(), 120)
        ON CONFLICT (user_id, page_id, lang)
        DO UPDATE SET
            guess_count = 5,
            completed = true,
            completed_at = now(),
            duration_seconds = 120;
    `
    await runSql(query)
}

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
    await page.goto(`${BASE_URL}/login`)
    // Dismiss Axeptio if present (same pattern as daily-game.spec.ts).
    for (const name of ['OK pour moi', 'Accepter', 'Accept all', 'Tout accepter']) {
        const btn = page.getByRole('button', { name }).first()
        const ok = await btn.click({ timeout: 1500 }).then(() => true).catch(() => false)
        if (ok) break
    }
    // Login form: email + password + submit. Uses placeholder / type selectors to
    // avoid brittle coupling to component internals.
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
    await emailInput.fill(email)
    await passwordInput.fill(password)
    await page.getByRole('button', { name: /se connecter|sign in|log in|connexion/i }).first().click()
    // Wait for navigation away from /login.
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
}

export const test = base.extend<Fixtures>({
    wonGamePage: async ({ page }, use) => {
        const email = process.env.PLAYWRIGHT_TEST_EMAIL
        const password = process.env.PLAYWRIGHT_TEST_PASSWORD
        if (!email || !password) {
            test.skip(
                true,
                'Set PLAYWRIGHT_TEST_EMAIL + PLAYWRIGHT_TEST_PASSWORD to run won-game restore/score regression tests',
            )
            return
        }
        if (!process.env.SUPABASE_ACCESS_TOKEN) {
            test.skip(true, 'Set SUPABASE_ACCESS_TOKEN (Management PAT) to seed the won-game fixture')
            return
        }

        const userId = await resolveUserId(email)
        const pageId = await resolveTodayPageId(TEST_LANG)
        await seedWonGame(userId, pageId, TEST_LANG)

        await loginViaUi(page, email, password)
        await page.goto(`${BASE_URL}/game?lang=${TEST_LANG}`)
        // Give the hydration path a moment to run and render restored state.
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

        await use(page)
    },
})

export { expect }
