// Phase 19 / Plan 01 — Setup project: pre-block Axeptio + persist storageState.
//
// Runs once before each browser project (chromium, webkit, chromium-mobile) via
// `dependencies: ['setup-consent']` in playwright.config.ts. Produces
// `playwright/.auth/consent-state.json` consumed by `use.storageState`.
//
// Strategy (D-04 + RESEARCH.md Pattern 1):
//   1. context.route blocks any axept*.io|eu|com network call.
//   2. addInitScript installs a MutationObserver that sweeps any Axeptio overlay
//      node injected via a cached path (belt-and-braces).
//   3. page.goto('/') materialises whatever cookies the app itself sets at root.
//   4. context.storageState() persists the resulting state to disk.

import { test as setup } from '@playwright/test'
import path from 'node:path'

const consentState = path.join(__dirname, '..', 'playwright', '.auth', 'consent-state.json')

setup('seed consent + block axeptio', async ({ page, context }) => {
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
  await page.goto('/')
  await context.storageState({ path: consentState })
})
