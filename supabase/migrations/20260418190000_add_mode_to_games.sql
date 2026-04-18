-- Phase 3 MODE-01: Add mode discriminator + JSONB config to games
-- References: .planning/phases/03-survival-mode/03-CONTEXT.md §Decisions D-01, D-03, D-04, D-12, D-13
--
-- D-01: Atomic JSONB chain mutation via SECURITY DEFINER RPC (avoid read-modify-write race)
-- D-03: Dual-purpose index on (mode, user_id) — per-mode leaderboards AND per-user-per-mode restore
-- D-04: Backfill existing daily rows via NOT NULL DEFAULT 'daily' (implicit rewrite in one statement)
-- D-12/D-13: leaderboard_survival sort by score DESC, chain_length DESC, completed_at ASC
--
-- All statements idempotent (IF NOT EXISTS / CREATE OR REPLACE); safe to re-run.
-- Wrapped in BEGIN…COMMIT so any syntax error rolls back atomically.
-- No DROP, no TRUNCATE — additive only.

BEGIN;

-- 1. Column additions (NOT NULL with DEFAULT performs implicit backfill for existing rows)
-- `score` is nullable: daily/ranked rows never had a persisted score (computed via view); survival rows
-- will write it at end-of-run (D-09, D-11). The leaderboard_survival view below references g.score
-- directly and must have the column to reference. [Rule 2: missing critical functionality from plan]
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS mode_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS score INTEGER;

-- 2. Dual-purpose index for per-mode leaderboards + per-user-per-mode restore (D-03)
CREATE INDEX IF NOT EXISTS games_mode_user_idx ON public.games (mode, user_id);

-- 3. leaderboard_survival view (D-12, D-13)
--    Sort: score DESC, chain_length DESC, completed_at ASC (tiebreak favors earlier completion)
--    Join profiles + filter completed/is_flagged mirrors Phase 2.1 leaderboard_daily precedent.
CREATE OR REPLACE VIEW public.leaderboard_survival AS
SELECT
  p.username,
  g.score,
  g.completed_at,
  (g.mode_config->>'language') AS lang,
  jsonb_array_length(COALESCE(g.mode_config->'chain', '[]'::jsonb)) AS chain_length,
  ROW_NUMBER() OVER (
    ORDER BY g.score DESC NULLS LAST,
             jsonb_array_length(COALESCE(g.mode_config->'chain', '[]'::jsonb)) DESC,
             g.completed_at ASC
  )::int AS position
FROM public.games g
JOIN public.profiles p ON p.id = g.user_id
WHERE g.mode = 'survival'
  AND g.completed = true
  AND g.is_flagged = false;

-- 4. survival_advance_chain RPC (D-01 atomic update; Pitfall 1 in 03-RESEARCH.md)
--    SECURITY DEFINER: callable from supabaseAdmin regardless of user auth context.
--    Scoped to mode='survival' so it cannot mutate daily rows (T-03-03 mitigation).
--    EXECUTE granted only to service_role.
CREATE OR REPLACE FUNCTION public.survival_advance_chain(
  p_game_id uuid,
  p_completed_article uuid,
  p_outcome text,
  p_next_article uuid
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.games
  SET mode_config = jsonb_set(
        jsonb_set(
          mode_config,
          '{chain}',
          COALESCE(mode_config->'chain', '[]'::jsonb) ||
            jsonb_build_array(jsonb_build_object(
              'page_id', p_completed_article::text,
              'outcome', p_outcome
            ))
        ),
        '{current_page_id}',
        to_jsonb(p_next_article::text)
      ) ||
      CASE WHEN p_outcome = 'gave_up'
        THEN jsonb_build_object(
          'lives_remaining',
          GREATEST(0, (mode_config->>'lives_remaining')::int - 1)
        )
        ELSE '{}'::jsonb
      END,
      page_id = p_next_article
  WHERE id = p_game_id
    AND mode = 'survival'
  RETURNING mode_config;
$$;

GRANT EXECUTE ON FUNCTION public.survival_advance_chain(uuid, uuid, text, uuid) TO service_role;

-- 5. Post-migration sanity check: abort transaction if backfill invariant violated
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.games WHERE mode IS NULL OR mode_config IS NULL) THEN
    RAISE EXCEPTION 'MODE-01 backfill failed: NULL mode or mode_config rows exist';
  END IF;
END $$;

COMMIT;
