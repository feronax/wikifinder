-- Phase 4 MP-01: Async Duel schema foundation
-- References: .planning/phases/04-async-duel/04-CONTEXT.md §Decisions D-05, D-06, D-16; 04-RESEARCH.md §Pattern 1 (RLS composition), §Pitfall 1 (partial unique index)
--
-- D-16 unblocker: replace games_user_page_lang_unique constraint with a PARTIAL unique index
--   scoped to mode='daily' so duel-mode rows can coexist with daily-mode rows for the same
--   (user, page, lang) tuple. Without this, recipients who already played today's daily
--   cannot join a duel on the same article (23505 violation).
--
-- All statements idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS + CREATE POLICY); safe to re-run.
-- Wrapped in BEGIN…COMMIT so any syntax error rolls back atomically.
-- Additive only — no DROP TABLE.

BEGIN;

-- 0. gen_random_uuid() availability (belt-and-suspenders; usually already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. multiplayer_rooms — the duel invitation record
CREATE TABLE IF NOT EXISTS public.multiplayer_rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id     uuid NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  lang        text NOT NULL CHECK (lang IN ('fr','en')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. room_players — participant roster (1-2 rows per room: creator + joiner)
-- PRIMARY KEY (room_id, user_id) doubles as the UNIQUE needed for idempotent ON CONFLICT joins (Pitfall 5).
CREATE TABLE IF NOT EXISTS public.room_players (
  room_id    uuid NOT NULL REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('creator','joiner')),
  game_id    uuid REFERENCES public.games(id) ON DELETE SET NULL,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- 3. Supporting indexes
CREATE INDEX IF NOT EXISTS idx_multiplayer_rooms_creator_id ON public.multiplayer_rooms(creator_id);
CREATE INDEX IF NOT EXISTS idx_multiplayer_rooms_expires_at ON public.multiplayer_rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_room_players_user_id ON public.room_players(user_id);

-- 4. Enable RLS
ALTER TABLE public.multiplayer_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players      ENABLE ROW LEVEL SECURITY;

-- 5. Policies (drop-and-recreate for idempotent re-apply, per Phase 3 precedent)

DROP POLICY IF EXISTS rooms_select_participant ON public.multiplayer_rooms;
CREATE POLICY rooms_select_participant
  ON public.multiplayer_rooms
  FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.room_players rp
      WHERE rp.room_id = multiplayer_rooms.id
        AND rp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rooms_insert_own ON public.multiplayer_rooms;
CREATE POLICY rooms_insert_own
  ON public.multiplayer_rooms
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS rp_select_own ON public.room_players;
CREATE POLICY rp_select_own
  ON public.room_players
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS rp_insert_self ON public.room_players;
CREATE POLICY rp_insert_self
  ON public.room_players
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS rp_update_self ON public.room_players;
CREATE POLICY rp_update_self
  ON public.room_players
  FOR UPDATE TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. D-16 Pitfall 1 fix — partial unique index scoped to daily mode
--    Replaces the Phase 2.1 games_user_page_lang_unique constraint so duel-mode rows can
--    coexist with daily-mode rows for the same (user, page, lang).
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_user_page_lang_unique;
CREATE UNIQUE INDEX IF NOT EXISTS games_user_page_lang_unique_daily
  ON public.games (user_id, page_id, lang)
  WHERE mode = 'daily';

-- 7. Post-migration sanity check: abort transaction if any invariant is violated
DO $$
DECLARE
  v_rooms_exists      boolean;
  v_rp_exists         boolean;
  v_rooms_rls         boolean;
  v_rp_rls            boolean;
  v_partial_idx       boolean;
  v_old_constraint    boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='multiplayer_rooms')
    INTO v_rooms_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='room_players')
    INTO v_rp_exists;
  SELECT relrowsecurity FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relname = 'multiplayer_rooms'
    INTO v_rooms_rls;
  SELECT relrowsecurity FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relname = 'room_players'
    INTO v_rp_rls;
  SELECT EXISTS (SELECT 1 FROM pg_indexes
                 WHERE schemaname='public'
                   AND tablename='games'
                   AND indexname='games_user_page_lang_unique_daily'
                   AND indexdef ILIKE '%WHERE%mode%daily%')
    INTO v_partial_idx;
  SELECT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'games_user_page_lang_unique')
    INTO v_old_constraint;

  IF NOT v_rooms_exists THEN
    RAISE EXCEPTION 'MP-01 invariant failed: multiplayer_rooms table missing';
  END IF;
  IF NOT v_rp_exists THEN
    RAISE EXCEPTION 'MP-01 invariant failed: room_players table missing';
  END IF;
  IF NOT v_rooms_rls THEN
    RAISE EXCEPTION 'MP-01 invariant failed: RLS not enabled on multiplayer_rooms';
  END IF;
  IF NOT v_rp_rls THEN
    RAISE EXCEPTION 'MP-01 invariant failed: RLS not enabled on room_players';
  END IF;
  IF NOT v_partial_idx THEN
    RAISE EXCEPTION 'MP-01 invariant failed: games_user_page_lang_unique_daily partial index missing or not scoped to daily';
  END IF;
  IF v_old_constraint THEN
    RAISE EXCEPTION 'MP-01 invariant failed: old games_user_page_lang_unique constraint still present (D-16 not applied)';
  END IF;
END $$;

COMMIT;
