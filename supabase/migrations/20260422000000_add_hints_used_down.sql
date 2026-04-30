-- Phase 10.3 — DOWN rollback for 20260422000000_add_hints_used.sql
-- Drops the games.hints_used column introduced for the new-design Indice feature.
-- Apply manually via Supabase Management PAT if the hint feature must be rolled back.
ALTER TABLE games
  DROP COLUMN hints_used;
