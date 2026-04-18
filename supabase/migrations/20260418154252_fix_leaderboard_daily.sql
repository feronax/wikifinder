-- Phase 2.1 Plan 02: redefine leaderboard_daily view to restore route contract
-- Root cause (see .planning/phases/02.1-prod-regression-fixes/02.1-02-PROBE.md):
--   The existing view omits `score` and `position` columns that the route
--   at wikifinder/src/app/api/leaderboard/route.ts selects. PostgREST errors
--   42703 ("column \"score\" does not exist"), route returns 500, client
--   falls back to empty array → "Aucun score disponible." in production.
--
-- Fix: add `score` (client-side scoring formula from src/lib/scoring.ts) and
--      `position` (ROW_NUMBER partitioned by date+lang) while preserving all
--      other columns and the existing join shape + filters.
--
-- Idempotent via CREATE OR REPLACE; no DROP, no data mutation.

CREATE OR REPLACE VIEW public.leaderboard_daily AS
SELECT
  p.username,
  g.guess_count,
  g.completed_at,
  g.duration_seconds,
  g.lang,
  pages.date,
  -- Mirror of src/lib/scoring.ts `calculateScore(guess_count, completed=true)`:
  --   if guess_count > 400 → 0
  --   else round(5000 * exp(-3.5 * max(0, guess_count - 45) / (400 - 45)))
  -- `g.completed = true` is already guaranteed by the WHERE clause below.
  CASE
    WHEN g.guess_count > 400 THEN 0
    ELSE ROUND(5000::numeric * EXP(-3.5::numeric * (GREATEST(0, g.guess_count - 45)::numeric / (400 - 45)::numeric)))::int
  END AS score,
  ROW_NUMBER() OVER (
    PARTITION BY pages.date, g.lang
    ORDER BY g.guess_count ASC, g.duration_seconds ASC
  )::int AS position
FROM games g
  JOIN profiles p ON p.id = g.user_id
  JOIN pages ON pages.id = g.page_id
WHERE g.completed = true
  AND g.is_flagged = false
ORDER BY pages.date DESC, g.guess_count ASC, g.duration_seconds ASC;
