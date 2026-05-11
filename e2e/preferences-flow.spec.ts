// Phase 8 Plan 05 — TH-06/TH-07/TH-08 e2e.
//
// Verifies the proxy.ts Accept-Language seed (D-06, D-06a) and — when an
// authed session exists — the Preferences card round-trip (TH-08).
//
// Auth note: /profile redirects unauthed users to /auth/login on mount. To
// keep this spec independent of any test-user fixture, the authed round-trip
// test is skipped when the redirect fires; it's covered manually in the dev
// smoke log (see 08-05-SUMMARY). The three proxy-seed tests run unauthenticated
// and exercise the full request path through proxy.ts.

import { test, expect } from './fixtures'

test.describe('Accept-Language proxy seed (D-06, D-06a)', () => {
  test('seeds wf_lang=en on first visit when Accept-Language prefers English', async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: 'en-US' })
    const page = await context.newPage()
    await page.goto('/')
    const cookies = await context.cookies()
    const langCookie = cookies.find((c) => c.name === 'wf_lang')
    expect(langCookie?.value).toBe('en')
    await context.close()
  })

  test('defaults wf_lang=fr when Accept-Language is neither fr nor en', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'zh-CN' })
    const page = await context.newPage()
    await page.goto('/')
    const cookies = await context.cookies()
    const langCookie = cookies.find((c) => c.name === 'wf_lang')
    expect(langCookie?.value).toBe('fr')
    await context.close()
  })

  test('does NOT overwrite an existing wf_lang cookie (D-06a)', async ({ browser }) => {
    // Pre-seed wf_lang=en via a prior French-locale visit would normally seed
    // 'fr'; we instead directly addCookies to simulate a prior explicit choice.
    const context = await browser.newContext({ locale: 'fr-FR' })
    await context.addCookies([
      {
        name: 'wf_lang',
        value: 'en',
        url: 'http://localhost:3000',
      },
    ])
    const page = await context.newPage()
    await page.goto('/')
    const cookies = await context.cookies()
    const langCookie = cookies.find((c) => c.name === 'wf_lang')
    expect(langCookie?.value).toBe('en')
    await context.close()
  })
})

test.describe('Preferences card (authed round-trip)', () => {
  test('FR→EN flip updates cookie and survives reload when user is authed', async ({
    page,
    context,
  }) => {
    await context.clearCookies()
    await page.goto('/profile?wf_new_design=1')
    await page.waitForLoadState('networkidle')
    if (page.url().includes('/auth/login')) {
      test.skip(
        true,
        'No test-user fixture available; authed round-trip covered in manual dev smoke',
      )
      return
    }

    const prefs = page.getByTestId('preferences-card')
    await expect(prefs).toBeVisible()

    await prefs.getByTestId('lang-en').click()
    await expect(prefs.getByTestId('lang-en')).toHaveAttribute('aria-pressed', 'true')

    const cookies = await context.cookies()
    const langCookie = cookies.find((c) => c.name === 'wf_lang')
    expect(langCookie?.value).toBe('en')

    await page.reload()
    await expect(page.getByTestId('preferences-card')).toBeVisible()
    await expect(page.getByTestId('lang-en')).toHaveAttribute('aria-pressed', 'true')
  })
})
