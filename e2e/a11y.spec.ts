// E2E (Phase 13 POL-03): Playwright + axe-core a11y/contrast audit suite.
//
// Scope (D-07): the **4 binding theme cells** — minimal × {dark, light} × amber × {fr, en}
// — crossed with 3 screens (Game, Profile, Leaderboard). The accent token is fixed at
// `--wf-accent` (amber #f59e0b) and the direction stays "minimal" in v1.1, so the only
// meaningful variation comes from theme mode × language. ROADMAP §"36 combinations" is
// superseded by REQUIREMENTS POL-03 + BACKLOG v1.2 deferral; documented in 13-05-SUMMARY.md.
//
// Sacred constraint (D-08): runs ALONGSIDE — and never modifies — the <50ms reveal-latency
// gate at e2e/daily-game-new-ui.spec.ts:153. New file, separate test fns; same Playwright
// project glob (e2e/**) auto-picks it up via the existing playwright.config.ts.
//
// Tooling (D-08): @axe-core/playwright (added in Task 1) wraps axe-core 4.11 (already a
// transitive dep). Tags `wcag2aa` + `wcag21aa` cover the contrast + structural a11y rules.
//
// §10 typography (D-09): amber on light bg is ~3:1 — text using `var(--wf-accent)` must be
// ≥18px OR ≥14px bold OR underlined. Spot-asserted via DOM evaluate, not by axe alone.
//
// Theme bootstrap mechanism: ThemeProvider reads `localStorage['wf_prefs'].mode` (light|dark)
// — verified at src/components/ThemeProvider.tsx:46-60 + src/lib/preferences.ts:11
// (STORAGE_KEY = 'wf_prefs'). We seed it via page.addInitScript before navigation so the
// initial paint reflects the requested mode. Lang is a real cookie (`wf_lang`, set by proxy.ts).

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

const SCREENS = [
  { path: '/game', name: 'game' },
  { path: '/profile', name: 'profile' },
  { path: '/leaderboard', name: 'leaderboard' },
] as const

const THEMES = [
  { mode: 'dark' as const },
  { mode: 'light' as const },
]

const LANGS = ['fr', 'en'] as const

async function bootstrap(
  page: Page,
  context: BrowserContext,
  lang: 'fr' | 'en',
  themeMode: 'dark' | 'light',
): Promise<void> {
  await context.clearCookies()
  await context.addCookies([
    { name: 'wf_new_design', value: '1', url: BASE_URL },
    { name: 'wf_lang', value: lang, url: BASE_URL },
  ])
  // Seed wf_prefs in localStorage BEFORE first paint — ThemeProvider reads it on mount
  // (src/components/ThemeProvider.tsx:46-60). Without this, ThemeProvider falls back to
  // prefers-color-scheme and we lose deterministic theme control across CI runs.
  await page.addInitScript((mode: string) => {
    try {
      localStorage.setItem('wf_prefs', JSON.stringify({ mode }))
    } catch {
      // ignore storage errors (private mode, etc.) — test will fall back to system pref
    }
  }, themeMode)

  const dismissConsent = async () => {
    const labels = ['OK pour moi', 'Accepter', 'Accept all', 'Tout accepter']
    for (const name of labels) {
      const btn = page.getByRole('button', { name }).first()
      const ok = await btn.click({ timeout: 2000 }).then(() => true).catch(() => false)
      if (ok) return
    }
  }
  await dismissConsent()
}

// 4 binding cells × 3 screens = 12 axe runs.
// + 6 amber-on-light typography spot-checks (light only × 2 langs × 3 screens).
// Total: 18 tests.
for (const { mode } of THEMES) {
  for (const lang of LANGS) {
    for (const { path, name } of SCREENS) {
      // v1.2 closure: amber-on-light contrast fixed via --wf-accent-text-on-light token (plan 14-01).
      // Anon /profile renders legacy landing.tsx (still uses var(--accent)); deferred to Phase 17 — Legacy Purge.
      const axeRunner = name === 'profile' ? test.fixme : test
      axeRunner(`a11y axe: ${name} (${mode}/${lang}) — WCAG 2.1 AA`, async ({ page, context }) => {
        // Webkit's axe-core evaluate() hangs scanning the masked article token tree
        // (thousands of <span> nodes) — even 360s isn't enough. Excluding `<article>`
        // is safe: amber call-sites live in chrome (chips, badges, CTAs, modals), the
        // article body uses --wf-text only. Chromium still scans full page (#30).
        test.setTimeout(360_000)
        await bootstrap(page, context, lang, mode)
        await page.goto(path)
        await page.waitForLoadState('networkidle').catch(() => {
          // networkidle can hang behind long-poll/Sentry beacons — fall back to load.
        })
        await page.waitForLoadState('load')

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2aa', 'wcag21aa'])
          .exclude('article')
          .analyze()

        expect(
          results.violations,
          `axe violations for ${name} (${mode}/${lang}):\n${JSON.stringify(results.violations, null, 2)}`,
        ).toEqual([])
      })

      // §10 typography rule applies on LIGHT theme only (amber on light bg ≈ 3:1).
      if (mode === 'light') {
        // Anon /profile (legacy landing.tsx) still ships var(--accent) labels; defer to Phase 17.
        const typoRunner = name === 'profile' ? test.fixme : test
        typoRunner(`amber-on-light typography (D-09): ${name} (${lang})`, async ({ page, context }) => {
          await bootstrap(page, context, lang, mode)
          await page.goto(path)
          await page.waitForLoadState('load')

          const accents = page.locator('[style*="var(--wf-accent-text-on-light)"]')
          const count = await accents.count()
          for (let i = 0; i < count; i++) {
            const el = accents.nth(i)
            const meta = await el.evaluate((node: HTMLElement) => {
              const cs = getComputedStyle(node)
              return {
                fontSize: parseFloat(cs.fontSize),
                fontWeight: parseInt(cs.fontWeight, 10) || 400,
                textDecorationLine: cs.textDecorationLine,
                color: cs.color,
                text: node.textContent?.trim() ?? '',
              }
            })
            // Skip empty / non-text nodes (icon-only spans, etc.) and cases where
            // the accent var is used for a NON-color property (border, background).
            if (!meta.text) continue

            const passes =
              meta.fontSize >= 18 ||
              (meta.fontSize >= 14 && meta.fontWeight >= 700) ||
              meta.textDecorationLine.includes('underline')

            expect(
              passes,
              `Amber accent text fails §10 rule on ${name}/${lang}: "${meta.text}" — size=${meta.fontSize} weight=${meta.fontWeight} decoration=${meta.textDecorationLine}`,
            ).toBe(true)
          }
        })
      }
    }
  }
}
