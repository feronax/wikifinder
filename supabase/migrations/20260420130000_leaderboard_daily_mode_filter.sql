-- Phase 6 follow-up: leaderboard_daily view was not filtering by mode.
-- Duels reuse the same page_id as the daily article, so a user who played
-- both the daily AND a duel appeared twice (once per mode='daily', once per
-- mode='duel') in /leaderboard?mode=daily.
--
-- Fix: add `AND g.mode = 'daily'` to the view's WHERE clause. Idempotent via
-- CREATE OR REPLACE. No data mutation. All other columns + scoring unchanged
-- from the Phase 2.1 Plan 02 definition.

BEGIN;

CREATE OR REPLACE VIEW public.leaderboard_daily AS
SELECT
  p.username,
  g.guess_count,
  g.completed_at,
  g.duration_seconds,
  g.lang,
  pages.date,
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
  AND g.mode = 'daily'
ORDER BY pages.date DESC, g.guess_count ASC, g.duration_seconds ASC;

COMMIT;
