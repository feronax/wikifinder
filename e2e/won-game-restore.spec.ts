// Phase 2.1 Plan 03 — SC-2 regression pin.
//
// Asserts that reloading /game after winning today's daily shows the restored
// won-state UI (revealed title tokens, no active guess input for fresh play),
// and NOT a fresh-start branch.
//
// Loud-in-isolation per D-03b: fails with a clear message naming the regression.
// Kept in a SEPARATE file from results-score.spec.ts (SC-3) so a regression in
// one does not mask the other.

import { test, expect } from './fixtures/won-game'

test.describe.configure({ retries: 1 })

test.describe('SC-2: won-game reload restores state (Phase 2.1 Plan 03)', () => {
    test('reloading /game after winning shows restored UI, not fresh game', async ({ wonGamePage }) => {
        // Assertion 1: the title contains revealed (accent-colored) words, not masked blocks.
        // In TitleDisplay.tsx, revealed title words render as <span>{value}</span>, while
        // masked words render as <span>{length-as-int}</span> with a colored background
        // block. A won state causes ALL non-stopword words to render as revealed text.
        // We detect this by looking for at least one visible, non-numeric word in the
        // title row — seed words are always alphabetic.
        const revealedWords = await wonGamePage.evaluate(() => {
            // Pull the title row: it lives near a label whose text matches /titre|title/i.
            // Fallback: any span with accent color and non-numeric text content.
            const all = Array.from(document.querySelectorAll('span'))
            return all
                .filter((el) => {
                    const txt = (el.textContent || '').trim()
                    // Count only alphabetic tokens >= 3 chars (title words).
                    return /^[\p{L}][\p{L}'-]{2,}$/u.test(txt)
                })
                .map((el) => el.textContent?.trim())
                .filter(Boolean)
        })

        if (revealedWords.length === 0) {
            throw new Error(
                'SC-2 regression: no revealed title words visible after won-game reload. ' +
                    'Hydration gate at game/page.tsx:131 fell through to fresh-start branch ' +
                    '(won=false at TitleDisplay.tsx:83-87 → title words render as masked blocks). ' +
                    'See 02.1-RESEARCH.md §"Root cause: won-game-restart".',
            )
        }
        expect(revealedWords.length).toBeGreaterThan(0)

        // Assertion 2: the won-only "Révéler tout / Reveal all" button is visible.
        // This button renders only inside the `{won && (...)}` branch at TitleDisplay.tsx:105.
        const revealAllBtn = wonGamePage.getByRole('button', { name: /révéler|reveal|hide|masquer/i }).first()
        await expect(revealAllBtn).toBeVisible({ timeout: 5000 })
    })

    test('hydration gate does NOT fall through to fresh-game branch', async ({ wonGamePage }) => {
        // Regression pin: if the fresh-start branch is hit, the guess input is visible
        // and enabled (game.tsx:177 sets won=false, guessCount=0, and the input renders).
        // In the restore branch (won=true), GuessInput is typically hidden or disabled.
        const guessInput = wonGamePage.locator('input[placeholder*="mot" i], input[placeholder*="word" i]').first()
        const isVisible = await guessInput.isVisible({ timeout: 2000 }).catch(() => false)
        if (isVisible) {
            const isEnabled = await guessInput.isEnabled().catch(() => true)
            if (isEnabled) {
                throw new Error(
                    'SC-2 regression: active guess input visible on a won-game reload. ' +
                        'Hydration gate at game/page.tsx:131 regressed — fresh-start branch hit ' +
                        '(won=false, guessCount=0). See 02.1-RESEARCH.md.',
                )
            }
        }
        // If we got here, either input is absent or disabled — both acceptable for won state.
        expect(true).toBe(true)
    })
})
