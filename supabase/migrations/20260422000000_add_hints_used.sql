-- Phase 10.3 — add hints_used tracking to games for the new-design Indice button (GS-03).
-- Score deduction (500pt per hint) is computed client-side in ResultModal; this column
-- only enforces the 3-hint cap server-side and tracks count for client display.
ALTER TABLE games
  ADD COLUMN hints_used INT NOT NULL DEFAULT 0;
