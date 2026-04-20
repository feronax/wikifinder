-- Phase 8 TH-06 D-01, D-01a: Single preferences JSONB column on profiles
-- References: .planning/phases/08-mode-toggle-language-pref/08-CONTEXT.md §Decisions D-01, D-01a
--
-- D-01: Single preferences jsonb column holds { lang?, mode? } and future v1.2 prefs
-- D-01a: Both fields optional; empty '{}' default for existing rows
--
-- Additive only. Idempotent (IF NOT EXISTS). Existing RLS policies on profiles
-- scoped `id = auth.uid()` cover this new column via column-grant inheritance.
-- No new RLS statements needed.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Post-migration invariant: column exists and every row has a non-null default.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'preferences'
  ) THEN
    RAISE EXCEPTION 'TH-06 invariant: profiles.preferences column was not added';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE preferences IS NULL) THEN
    RAISE EXCEPTION 'TH-06 invariant: NULL preferences rows exist after backfill';
  END IF;
END $$;

COMMIT;
