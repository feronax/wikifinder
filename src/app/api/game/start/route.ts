import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createHash } from 'crypto'
import { parseJsonBody, UuidSchema, LangSchema } from '@/lib/validation'
import { isExpired } from '@/lib/duel'

const StartBodySchema = z.object({ lang: LangSchema, pageId: UuidSchema })

export async function POST(req: NextRequest) {
  // Phase 4 Plan 03 — ?duel=<roomId> branch (D-04, D-16 partial-index fix).
  // Must run BEFORE body parse so Zod failures don't swallow legitimate duel requests
  // whose body may be empty (the duel branch derives lang + pageId from the room).
  const duelId = new URL(req.url).searchParams.get('duel')
  if (duelId) {
    const dp = UuidSchema.safeParse(duelId)
    if (!dp.success) return NextResponse.json({ error: 'Invalid duel id' }, { status: 400 })
    return handleDuelStart(req, dp.data)
  }

  const parsed = await parseJsonBody(req, StartBodySchema)
  if ('error' in parsed) return parsed.error
  const { lang, pageId } = parsed.data

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ saved: false, anonymous: true })

  // Cherche la meilleure partie existante (complétée en priorité, sinon la plus récente).
  // maybeSingle() handles zero-or-one cleanly; .single() rejects multi-row matches with
  // PGRST116 and the prior silent destructure fell through to fresh-insert → SC-2/SC-3
  // regression. UNIQUE(user_id, page_id, lang) now prevents multi-row matches at the DB
  // layer (see supabase/migrations/20260418155343_dedupe_games_and_add_unique.sql).
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('games')
    .select('id, user_id, page_id, lang, guess_count, completed, completed_at, duration_seconds, ip_hash, started_at')
    .eq('user_id', user.id)
    .eq('page_id', pageId)
    .eq('lang', lang)
    .order('completed', { ascending: false })
    .order('guess_count', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingErr) {
    // [api/game/start] surface PostgREST errors rather than silently inserting a fresh game
    return NextResponse.json({ error: existingErr.message }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ saved: true, game: existing })
  }

  // Calcule le hash IP + navigateur
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const userAgent = req.headers.get('user-agent') || 'unknown'
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
  const browserHash = createHash('sha256').update(userAgent).digest('hex').slice(0, 16)

  const { data: sameIpGames } = await supabaseAdmin
    .from('games')
    .select('user_id')
    .eq('ip_hash', ipHash)
    .eq('page_id', pageId)
    .neq('user_id', user.id)

  const isFlagged = (sameIpGames?.length || 0) > 0

  const { data: game, error } = await supabaseAdmin
    .from('games')
    .insert({
      user_id: user.id,
      page_id: pageId,
      lang,
      guess_count: 0,
      completed: false,
      ip_hash: ipHash,
      browser_hash: browserHash,
      is_flagged: isFlagged,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ saved: true, game })
}

// Phase 4 Plan 03 Task 4 — duel-branch handler for /api/game/start?duel=<roomId>.
// Insert a mode='duel' games row bound to the room, UPDATE room_players.game_id.
// Leans on Plan 01 partial unique index to coexist with the user's daily row (D-16).
async function handleDuelStart(req: NextRequest, duelId: string) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

    const { data: room, error: roomErr } = await supabaseAdmin
      .from('multiplayer_rooms')
      .select('id, creator_id, page_id, lang, expires_at')
      .eq('id', duelId)
      .maybeSingle()
    if (roomErr) {
      Sentry.captureException(roomErr, { tags: { context: 'api/game/start', phase: 'duel-load-room' } })
      return NextResponse.json({ error: "Couldn't start duel" }, { status: 500 })
    }
    if (!room) return NextResponse.json({ error: 'Duel not found' }, { status: 404 })
    if (isExpired(room.expires_at)) {
      return NextResponse.json({ error: 'expired' }, { status: 410 })
    }

    // Participant check — creator is inserted into room_players at create-time (Plan 01).
    const { data: rp, error: rpErr } = await supabaseAdmin
      .from('room_players')
      .select('user_id')
      .eq('room_id', duelId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (rpErr) {
      Sentry.captureException(rpErr, { tags: { context: 'api/game/start', phase: 'duel-check-participant' } })
      return NextResponse.json({ error: "Couldn't start duel" }, { status: 500 })
    }
    if (!rp) return NextResponse.json({ error: 'not_participant' }, { status: 403 })

    // Check for already-bound duel game for this user+room (idempotent restart).
    const { data: existing } = await supabaseAdmin
      .from('games')
      .select('id, user_id, page_id, lang, guess_count, completed, completed_at, duration_seconds, started_at, mode, mode_config')
      .eq('user_id', user.id)
      .eq('page_id', room.page_id)
      .eq('lang', room.lang)
      .eq('mode', 'duel')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ saved: true, game: existing })
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
    const browserHash = createHash('sha256').update(userAgent).digest('hex').slice(0, 16)
    const nowIso = new Date().toISOString()

    const { data: game, error: insErr } = await supabaseAdmin
      .from('games')
      .insert({
        user_id: user.id,
        page_id: room.page_id,
        lang: room.lang,
        guess_count: 0,
        completed: false,
        ip_hash: ipHash,
        browser_hash: browserHash,
        is_flagged: false,
        mode: 'duel',
        mode_config: { room_id: duelId, page_id: room.page_id },
        started_at: nowIso,
      })
      .select()
      .single()
    if (insErr || !game) {
      Sentry.captureException(insErr ?? new Error('duel game insert returned no row'), {
        tags: { context: 'api/game/start', phase: 'duel-insert' },
      })
      return NextResponse.json({ error: "Couldn't start duel" }, { status: 500 })
    }

    const { error: updErr } = await supabaseAdmin
      .from('room_players')
      .update({ game_id: game.id })
      .eq('room_id', duelId)
      .eq('user_id', user.id)
    if (updErr) {
      Sentry.captureException(updErr, { tags: { context: 'api/game/start', phase: 'duel-bind-game' } })
      // Non-fatal: the games row exists; a subsequent /api/duel/[id] lookup can heal.
    }

    return NextResponse.json({ saved: true, game })
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'api/game/start', phase: 'duel' } })
    return NextResponse.json({ error: "Couldn't start duel" }, { status: 500 })
  }
}