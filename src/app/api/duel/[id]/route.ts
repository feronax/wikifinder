import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { compareResults, isExpired, type HalfResult } from '@/lib/duel'

// Phase 4 Plan 03 — GET /api/duel/[id]
// MP-04 reveal-gated state payload.
// Pitfall 7 guarantee: pre-reveal opponent payload is { username, state } ONLY —
// never guessCount/durationSec. Test file pins this as a regression.

type GameRow = {
  id: string
  user_id: string
  guess_count: number | null
  duration_seconds: number | null
  completed: boolean
  completed_at: string | null
  won: boolean
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  try {
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('multiplayer_rooms')
      .select('id, creator_id, page_id, lang, expires_at')
      .eq('id', id)
      .maybeSingle()
    if (roomErr) {
      Sentry.captureException(roomErr, {
        tags: { context: 'api/duel/[id]', phase: 'load-room' },
      })
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    const expired = isExpired(room.expires_at)

    const { data: playersRaw } = await supabaseAdmin
      .from('room_players')
      .select('user_id, role, game_id')
      .eq('room_id', id)
    const players = (playersRaw ?? []) as Array<{ user_id: string; role: string; game_id: string | null }>
    const playerUserIds = players.map(p => p.user_id)
    const isParticipant = !!user && playerUserIds.includes(user.id)
    const isCreator = !!user && user.id === room.creator_id

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .in('id', [room.creator_id, ...playerUserIds])
    const usernameFor = (uid: string) =>
      (profiles as Array<{ id: string; username: string }> | null)?.find(p => p.id === uid)?.username ?? 'Player'

    const titleCol = `wikipedia_title_${room.lang}`
    const { data: page } = await supabaseAdmin
      .from('pages')
      .select(titleCol)
      .eq('id', room.page_id)
      .maybeSingle()
    const articleTitle = (page as Record<string, unknown> | null)?.[titleCol] as string ?? ''

    const roomSummary = {
      id: room.id,
      lang: room.lang as 'fr' | 'en',
      articleTitle,
      expiresAt: room.expires_at,
      creatorUsername: usernameFor(room.creator_id),
    }

    // Third party = room is FULL (both slots taken) AND viewer is neither participant.
    // When the room still has an open slot, an authed non-creator is a candidate joiner
    // and falls through to the lobby branch (D-10 recipient flow).
    if (user && !isParticipant && !isCreator && players.length >= 2) {
      return NextResponse.json({
        state: 'private' as const,
        room: roomSummary,
        viewer: { role: 'third-party' as const },
      })
    }

    const gameIds = players.map(p => p.game_id).filter((g): g is string => !!g)
    const gamesResult = gameIds.length
      ? await supabaseAdmin
          .from('games')
          .select('id, user_id, guess_count, duration_seconds, completed, completed_at, won')
          .in('id', gameIds)
      : { data: [] as GameRow[] }
    const games = (gamesResult.data ?? []) as GameRow[]
    const gameFor = (uid: string) => games.find(g => g.user_id === uid) ?? null

    const bothFinished = players.length === 2 && players.every(p => gameFor(p.user_id)?.completed === true)
    const revealComparison = bothFinished || expired

    const toHalf = (userId: string): HalfResult => {
      const g = gameFor(userId)
      const finished = g?.completed === true
      return {
        userId,
        username: usernameFor(userId),
        won: g?.won === true,
        guessCount: finished ? (g?.guess_count ?? null) : null,
        durationSec: finished ? (g?.duration_seconds ?? null) : null,
        dnf: expired && !finished,
      }
    }

    // Anonymous viewer: lobby only, never opponent numbers.
    if (!user) {
      return NextResponse.json({
        state: 'lobby' as const,
        room: roomSummary,
        viewer: { role: 'candidate' as const },
      })
    }

    const viewerRole = isCreator ? 'creator' as const : 'joiner' as const

    if (!revealComparison) {
      // PRE-REVEAL — Pitfall 7 guard.
      const viewerHalf = toHalf(user.id)
      const opponentUid = playerUserIds.find(uid => uid !== user.id)
      const opponentFinished = opponentUid ? gameFor(opponentUid)?.completed === true : false
      const opponent = opponentUid
        ? {
            username: usernameFor(opponentUid),
            state: opponentFinished ? ('finished' as const) : ('playing' as const),
          }
        : null
      const viewerFinished = gameFor(user.id)?.completed === true
      return NextResponse.json({
        state: viewerFinished ? ('waiting' as const) : ('lobby' as const),
        room: roomSummary,
        viewer: { role: viewerRole, ...viewerHalf },
        opponent,
      })
    }

    // REVEAL — both finished OR expired.
    if (playerUserIds.length < 2) {
      return NextResponse.json({
        state: 'expired-none' as const,
        room: roomSummary,
        viewer: { role: viewerRole },
      })
    }

    const a = toHalf(playerUserIds[0])
    const b = toHalf(playerUserIds[1])
    const comparison = compareResults(a, b)
    const bothDnf = a.dnf && b.dnf
    const state = bothDnf
      ? ('expired-none' as const)
      : bothFinished
        ? ('ready' as const)
        : ('expired-one' as const)

    return NextResponse.json({
      state,
      room: roomSummary,
      viewer: { role: viewerRole },
      comparison,
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'api/duel/[id]' } })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
