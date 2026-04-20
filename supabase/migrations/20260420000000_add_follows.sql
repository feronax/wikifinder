-- Phase 5 / 05-02 — MP-06 follows graph (D-01, D-04, D-33)
-- Apply via Supabase Management API per Phase 4 D-33 precedent.
--
-- Pre-apply audit (2026-04-20, see 05-02-MIGRATION-VERIFY.md):
--   - profiles SELECT policy already permissive (qual=true) → no conditional
--     profiles_select_public_username policy needed in this migration.
--   - profiles.lang_pref is ABSENT → Plan 05-03 uses ?lang= fallback.
--
-- All statements idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS + CREATE POLICY).
-- Wrapped in single BEGIN…COMMIT so any syntax error rolls back atomically.

BEGIN;

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

-- Supporting indexes (PK already covers (follower_id, followee_id) lookups).
-- Separate single-column indexes accelerate reverse lookups (who follows X?)
-- and the feed fan-out query in Plan 05-03.
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee_id ON public.follows(followee_id);

-- RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_select_endpoint ON public.follows;
CREATE POLICY follows_select_endpoint
  ON public.follows
  FOR SELECT TO authenticated
  USING (follower_id = auth.uid() OR followee_id = auth.uid());

DROP POLICY IF EXISTS follows_insert_self ON public.follows;
CREATE POLICY follows_insert_self
  ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS follows_delete_self ON public.follows;
CREATE POLICY follows_delete_self
  ON public.follows
  FOR DELETE TO authenticated
  USING (follower_id = auth.uid());

-- (No UPDATE policy — follows are append-only + delete-only per D-05 idempotency policy.)

-- Invariants
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='follows') THEN
    RAISE EXCEPTION 'MP-06 invariant: follows table missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE relnamespace='public'::regnamespace AND relname='follows') THEN
    RAISE EXCEPTION 'MP-06 invariant: RLS not enabled on follows';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                 JOIN pg_class t ON t.oid = c.conrelid
                 WHERE t.relname='follows' AND c.contype='c') THEN
    RAISE EXCEPTION 'MP-06 invariant: CHECK constraint (self-follow guard) missing';
  END IF;
END $$;

COMMIT;
