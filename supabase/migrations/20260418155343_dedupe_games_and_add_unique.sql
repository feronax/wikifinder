-- Phase 2.1 Plan 03 Branch A (A2.CASCADE option (ii)):
-- Collapse duplicate (user_id, page_id, lang) rows in `games` and add a UNIQUE
-- constraint to prevent recurrence. Under the existing CASCADE FK on
-- guesses.game_id, a naive DELETE on games would silently erase 233 guess
-- rows (see 02.1-03-PROBE.md §"Dry-run counts"). Instead, re-point those
-- guesses onto the surviving ("winner") game row first, so guess history is
-- preserved under the canonical games row.
--
-- Winner selection (per plan): highest `completed`, then highest `guess_count`,
-- then most-recent `started_at`. (Plan template said `created_at`, but Probe E
-- confirmed `games` has no `created_at` column — only `started_at`. Adjusted.)
--
-- Probe evidence locked:
--   - Probe D.2: 9 duplicate (user_id, page_id, lang) keys, 20 loser rows
--   - Guesses at risk under CASCADE: 233 (preserved via re-point below)
--   - Probe F: ON DELETE CASCADE; guesses.game_id IS NULLABLE (backup strategy not used)
--
-- D-02 (daily-only): duplicates span only daily `games` rows; ranked uses
-- ranked_pages, not this table. Applying a UNIQUE across all games rows is
-- scoped to the intended table and does not touch ranked/global paths.

BEGIN;

-- Step 1: Re-point `guesses.game_id` from loser rows to the corresponding winner.
-- This is the DATA-PRESERVING move — CASCADE would have deleted these 233 rows.
WITH ranked AS (
    SELECT id, user_id, page_id, lang,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, page_id, lang
               ORDER BY completed DESC NULLS LAST,
                        guess_count DESC,
                        started_at DESC
           ) AS rn
    FROM public.games
),
winners AS (
    SELECT user_id, page_id, lang, id AS winner_id
    FROM ranked
    WHERE rn = 1
),
losers AS (
    SELECT r.id AS loser_id, w.winner_id
    FROM ranked r
    JOIN winners w USING (user_id, page_id, lang)
    WHERE r.rn > 1
)
UPDATE public.guesses g
SET game_id = l.winner_id
FROM losers l
WHERE g.game_id = l.loser_id;

-- Step 2: Delete the loser rows from `games`. CASCADE now has nothing to
-- cascade because all dependent guesses were re-pointed in Step 1.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, page_id, lang
               ORDER BY completed DESC NULLS LAST,
                        guess_count DESC,
                        started_at DESC
           ) AS rn
    FROM public.games
)
DELETE FROM public.games
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 3: Add UNIQUE constraint to prevent recurrence. If any duplicates
-- remained (they should not — Step 2 collapsed them), this will fail and
-- roll back the transaction.
ALTER TABLE public.games
ADD CONSTRAINT games_user_page_lang_unique
UNIQUE (user_id, page_id, lang);

COMMIT;
