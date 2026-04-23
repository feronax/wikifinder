-- Phase 11 / FR-04 — add profiles.last_activity_at for presence (D-04)
-- Apply via Supabase Management API per Phase 4 D-33 precedent.
--
-- Pre-apply audit: profiles SELECT policy already permissive (qual=true) per
-- 20260420000000_add_follows.sql:4-6 / 05-02-MIGRATION-VERIFY.md.
-- D-04 is enforced at API-layer projection (Path 1 per 11-RESEARCH.md) —
-- this migration only adds the column + presence index; no policy split.
--
-- All statements idempotent (IF NOT EXISTS).
-- Wrapped in single BEGIN…COMMIT so any syntax error rolls back atomically.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- Partial index for presence "online" queries (≤5 min window per D-05).
-- Filtered to last 7 days to keep index small.
CREATE INDEX IF NOT EXISTS idx_profiles_last_activity_recent
  ON public.profiles (last_activity_at DESC)
  WHERE last_activity_at > now() - interval '7 days';

-- Invariant: column must exist after migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
      AND column_name='last_activity_at'
  ) THEN
    RAISE EXCEPTION 'FR-04 invariant: profiles.last_activity_at missing';
  END IF;
END $$;

COMMIT;
