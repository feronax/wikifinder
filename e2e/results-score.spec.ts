// Phase 2.1 Plan 03 — SC-3 regression pin.
//
// Asserts that the score box renders with a non-zero value on the won-game
// results screen. Bug mode: {won && ...} gate at TitleDisplay.tsx:144 hides the
// score box when the hydration path sets won=false on a reload (same upstream
// root cause as SC-2, but asserted separately per D-03b so regressions in
// either symptom fail loud in isolation).

import { test, expect } from './fixtures/won-game'

test.describe.configure({ retries: 1 })

test.describe('SC-3: score visible on results screen (Phase 2.1 Plan 03)', () => {
    test('won-game reload shows score box with non-zero score', async ({ wonGamePage }) => {
        // TitleDisplay.tsx:144-150: score box renders a large number (the score
        // via score.toLocaleString()) followed by t.pts ("pts" in fr, "points" in
        // en). Locate the score NUMBER by finding a span/div whose text is a
        // pure integer followed by the "pts" sibling.
        // We pick the node whose text contains a comma-or-space-formatted integer
        // AND whose container has a sibling with "pts" text.
        const scoreValue = await wonGamePage.evaluate(() => {
            // Walk all elements and find one whose text matches a formatted integer
            // of at least 3 digits (scores are 0-5000 with a non-zero minimum ~1000
            // for a completed game). Match with optional thousands separators.
            const candidates = Array.from(document.querySelectorAll('div'))
            for (const el of candidates) {
                const txt = (el.textContent || '').trim()
                // Score renders as `score.toLocaleString()` — "5,000" in en, "5 000" or "5000" in fr.
                if (/^\d[\d\s,.\u00a0]*$/.test(txt) && txt.replace(/[^\d]/g, '').length >= 3) {
                    const parent = el.parentElement
                    if (!parent) continue
                    // Look for a sibling with "pts" text in the same container.
                    const sibs = parent.children
                    for (let i = 0; i < sibs.length; i++) {
                        const sib = sibs[i] as HTMLElement
                        if (/^pts?$|^points?$/i.test((sib.textContent || '').trim())) {
                            return parseInt(txt.replace(/[^\d]/g, ''), 10)
                        }
                    }
                }
            }
            return null
        })

        if (scoreValue === null) {
            throw new Error(
                'SC-3 regression: score box not found on results screen despite won game. ' +
                    "TitleDisplay.tsx:144 `{won && ...}` gate saw won=false — hydration branch at " +
                    'game/page.tsx:131 fell through to fresh-start. See 02.1-RESEARCH.md.',
            )
        }
        expect(scoreValue).toBeGreaterThan(0)
    })

    test('score box is NOT hidden by {won && ...} gate regression', async ({ wonGamePage }) => {
        // Separate assertion: look specifically for the `pts` label, which only
        // renders inside the score-box subtree (TitleDisplay.tsx:148).
        const ptsLabel = wonGamePage.getByText(/^pts?$|^points?$/i).first()
        const visible = await ptsLabel.isVisible({ timeout: 5000 }).catch(() => false)
        if (!visible) {
            throw new Error(
                'SC-3 regression: `pts` label (score-box tail) missing. ' +
                    'TitleDisplay.tsx:144-150 `{won && ...}` gate evaluated to false. ' +
                    'Root cause likely shares layer with SC-2 (hydration). See 02.1-RESEARCH.md.',
            )
        }
        expect(visible).toBe(true)
    })
})
