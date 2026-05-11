// Phase 19 / Plan 01 — Shared Playwright fixtures.
//
// Overrides the `context` fixture so every test that imports `{ test, expect }`
// from this module automatically blocks Axeptio at the network layer AND
// installs a MutationObserver sweep via `addInitScript` BEFORE any page
// navigation. This replaces the previous setup-project + storageState
// approach, which was architecturally ineffective: `storageState` carries
// cookies + localStorage but does NOT persist route handlers or init scripts,
// so downstream specs that inherited it got no Axeptio suppression.
//
// Idiomatic Playwright fixture extension — every spec just changes its import
// line from `@playwright/test` to `./fixtures` and inherits the behaviour.
//
// Strategy (D-04 + RESEARCH.md Pattern 1):
//   1. context.route blocks any axept*.io|eu|com network call.
//   2. addInitScript installs a MutationObserver that sweeps any Axeptio
//      overlay node injected via a cached path (belt-and-braces).
//   3. The observer starts on DOMContentLoaded if the doc is still loading,
//      otherwise immediately.

import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(/axept(?:io)?\.(?:io|eu|com)/i, (route) => route.abort())
    await context.addInitScript(() => {
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
    await use(context)
  },
})

export { expect }
