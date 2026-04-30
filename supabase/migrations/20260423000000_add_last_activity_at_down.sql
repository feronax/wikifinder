-- Phase 11 / FR-04 — DOWN migration: drop profiles.last_activity_at.
-- Paired with 20260423000000_add_last_activity_at.sql.

BEGIN;

DROP INDEX IF EXISTS public.idx_profiles_last_activity_recent;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS last_activity_at;

COMMIT;
