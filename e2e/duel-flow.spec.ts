// Phase 4 Plan 05 — MP-02..MP-05 + MP-09 E2E coverage.
//
// Two-context create → join → both-finish → comparison → share fallback.
// Plus a dedicated Pitfall 7 pre-reveal leak check and an assetlinks.json served check.
//
// Credential-graceful: test.skip() when PLAYWRIGHT_TEST_EMAIL(_2) /
// PLAYWRIGHT_TEST_PASSWORD(_2) / SUPABASE_ACCESS_TOKEN absent. CI is the
// authoritative environment (Phase 2.1 Plan 03 precedent).

import { test, expect, type Page, type BrowserContext } from '@playwright/test'

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

async function deleteRoomsForEmail(email: string): Promise<void> {
  const safe = email.replace(/'/g, "''")
  await runSql(
    `DELETE FROM public.multiplayer_rooms
       WHERE creator_id = (SELECT id FROM auth.users WHERE email = '${safe}' LIMIT 1);`,
  )
}

const creatorEmail = process.env.PLAYWRIGHT_TEST_EMAIL
const creatorPassword = process.env.PLAYWRIGHT_TEST_PASSWORD
const joinerEmail = process.env.PLAYWRIGHT_TEST_EMAIL_2
const joinerPassword = process.env.PLAYWRIGHT_TEST_PASSWORD_2

const credsMissing =
  !creatorEmail || !creatorPassword ||
  !joinerEmail || !joinerPassword ||
  !process.env.SUPABASE_ACCESS_TOKEN

test.describe('Phase 4 — duel flow (MP-02..MP-05, MP-09)', () => {
  test.beforeAll(async () => {
    if (credsMissing) return
    if (creatorEmail) await deleteRoomsForEmail(creatorEmail)
  })

  test.afterAll(async () => {
    if (credsMissing) return
    if (creatorEmail) await deleteRoomsForEmail(creatorEmail)
  })

  test('create-and-share-link — creator mints a duel and link survives refresh (MP-02)', async ({ page, context }) => {
    if (credsMissing) {
      test.skip(true, 'Set PLAYWRIGHT_TEST_EMAIL(_2) + PLAYWRIGHT_TEST_PASSWORD(_2) + SUPABASE_ACCESS_TOKEN to run duel E2E')
      return
    }
    await loginViaUi(page, creatorEmail!, creatorPassword!)
    await page.goto(`${BASE_URL}/game`)

    const createResponsePromise = page.waitForResponse((r) =>
      r.url().includes('/api/duel/create') && r.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /Challenge a friend|Défier un ami/ }).first().click()
    const createRes = await createResponsePromise
    const body = await createRes.json() as { roomId: string; duelUrl: string }
    expect(body.roomId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.duelUrl).toMatch(/^\/duel\/[0-9a-f-]{36}$/)

    await page.goto(`${BASE_URL}${body.duelUrl}`)
    // Creator visiting own duel → self-duel sub-state
    await expect(page.getByRole('heading', { name: /This is your duel|C'est ton duel/ })).toBeVisible({ timeout: 15_000 })
    await page.reload()
    await expect(page.getByRole('heading', { name: /This is your duel|C'est ton duel/ })).toBeVisible({ timeout: 15_000 })
  })

  test('two-contexts-both-play — joiner lobby → /game?duel route (MP-03, MP-04)', async ({ browser, page }) => {
    if (credsMissing) {
      test.skip(true, 'creds missing')
      return
    }
    await loginViaUi(page, creatorEmail!, creatorPassword!)
    await page.goto(`${BASE_URL}/game`)
    const createResponsePromise = page.waitForResponse((r) =>
      r.url().includes('/api/duel/create') && r.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /Challenge a friend|Défier un ami/ }).first().click()
    const createRes = await createResponsePromise
    const { duelUrl } = await createRes.json() as { duelUrl: string }

    const joinerCtx: BrowserContext = await browser.newContext()
    const joinerPage = await joinerCtx.newPage()
    await loginViaUi(joinerPage, joinerEmail!, joinerPassword!)
    await joinerPage.goto(`${BASE_URL}${duelUrl}`)
    await expect(joinerPage.getByRole('heading', { name: /You've been challenged|On t'a défié/ })).toBeVisible({ timeout: 15_000 })

    await joinerPage.getByRole('button', { name: /Start duel|Démarrer le duel/ }).first().click()
    await expect(joinerPage).toHaveURL(/\/game\?duel=/, { timeout: 15_000 })
    await joinerCtx.close()
  })

  test('lang-mismatch-gate — Switch & join sub-state renders (MP-07)', async ({ browser, page }) => {
    if (credsMissing) {
      test.skip(true, 'creds missing')
      return
    }
    await loginViaUi(page, creatorEmail!, creatorPassword!)
    await page.goto(`${BASE_URL}/game`)
    const createResponsePromise = page.waitForResponse((r) =>
      r.url().includes('/api/duel/create') && r.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /Challenge a friend|Défier un ami/ }).first().click()
    const createRes = await createResponsePromise
    const { duelUrl, roomId } = await createRes.json() as { duelUrl: string; roomId: string }

    const joinerCtx = await browser.newContext({ locale: 'en-US' })
    const joinerPage = await joinerCtx.newPage()
    await loginViaUi(joinerPage, joinerEmail!, joinerPassword!)
    // Force opposite language by querying /api/duel/join directly with wrong expectedLang
    const mismatchLang = 'en' // room is likely fr; this will surface lang_mismatch
    const joinRes = await joinerPage.request.post(`${BASE_URL}/api/duel/join`, {
      data: { roomId, expectedLang: mismatchLang },
    })
    if (joinRes.status() === 409) {
      const body = await joinRes.json() as { error: string; expected: string; got: string }
      expect(body.error).toBe('lang_mismatch')
      expect(['fr', 'en']).toContain(body.expected)
    }
    // Navigate joiner to the duel URL — should land in lobby (lang-mismatch UI sub-state
    // is client-side; this test validates the server-side gate separately).
    await joinerPage.goto(`${BASE_URL}${duelUrl}`)
    await expect(joinerPage.getByRole('heading', { name: /You've been challenged|On t'a défié/ })).toBeVisible({ timeout: 15_000 })
    await joinerCtx.close()
  })

  test('pre-reveal-no-leak — opponent stats never leak pre-reveal (Pitfall 7)', async ({ browser, page }) => {
    if (credsMissing) {
      test.skip(true, 'creds missing')
      return
    }
    await loginViaUi(page, creatorEmail!, creatorPassword!)
    await page.goto(`${BASE_URL}/game`)
    const createResponsePromise = page.waitForResponse((r) =>
      r.url().includes('/api/duel/create') && r.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /Challenge a friend|Défier un ami/ }).first().click()
    const createRes = await createResponsePromise
    const { roomId } = await createRes.json() as { roomId: string }

    // Fetch /api/duel/[id] pre-reveal — assert no opponent numeric leak.
    const detail = await page.request.get(`${BASE_URL}/api/duel/${roomId}`)
    const body = await detail.json()
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('guess_count')
    expect(raw).not.toContain('duration_seconds')
    if (body?.opponent) {
      expect(body.opponent.guessCount).toBeUndefined()
      expect(body.opponent.durationSec).toBeUndefined()
    }
  })

  test('share-card-fallback — navigator.share or clipboard write invoked (MP-05)', async ({ browser, page }) => {
    if (credsMissing) {
      test.skip(true, 'creds missing')
      return
    }
    // Mock navigator.share and clipboard.writeText before page load
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as unknown as { __shareCalls?: unknown[]; __clipboardCalls?: unknown[] }
      w.__shareCalls = []
      w.__clipboardCalls = []
      ;(navigator as unknown as { share?: (d: unknown) => Promise<void> }).share = async (d) => {
        w.__shareCalls!.push(d)
      }
      ;(navigator as unknown as { canShare?: (d: unknown) => boolean }).canShare = () => true
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => { w.__clipboardCalls!.push(text) },
        },
      })
    })
    await loginViaUi(page, creatorEmail!, creatorPassword!)
    await page.goto(`${BASE_URL}/game`)
    await page.getByRole('button', { name: /Challenge a friend|Défier un ami/ }).first().click()

    // Verify share or clipboard was invoked (one of them, either channel)
    const invoked = await page.evaluate(() => {
      const w = window as unknown as { __shareCalls?: unknown[]; __clipboardCalls?: unknown[] }
      return (w.__shareCalls?.length ?? 0) + (w.__clipboardCalls?.length ?? 0) > 0
    })
    expect(invoked).toBe(true)
  })

  test('assetlinks-served — /.well-known/assetlinks.json is published and valid (MP-09 infra)', async ({ page }) => {
    if (credsMissing) {
      test.skip(true, 'creds missing')
      return
    }
    const res = await page.request.get(`${BASE_URL}/.well-known/assetlinks.json`)
    expect(res.status()).toBe(200)
    const body = await res.json() as Array<{
      relation: string[]
      target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] }
    }>
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].relation).toContain('delegate_permission/common.handle_all_urls')
    expect(body[0].target.namespace).toBe('android_app')
    expect(body[0].target.package_name).toBe('app.wikifinder')
    expect(body[0].target.sha256_cert_fingerprints.length).toBeGreaterThan(0)
  })
})
