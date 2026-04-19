import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseJsonBody, DuelJoinSchema } from '@/lib/validation'
import { isExpired } from '@/lib/duel'

// Phase 4 Plan 03 — POST /api/duel/join
// MP-03 + MP-07: join gates — lang match, self-duel block, expiry, dup-join idempotency (Pitfall 5).

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, DuelJoinSchema)
  if ('error' in parsed) return parsed.error
  const { roomId, expectedLang } = parsed.data

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

    const { data: room, error: loadErr } = await supabaseAdmin
      .from('multiplayer_rooms')
      .select('id, creator_id, page_id, lang, expires_at')
      .eq('id', roomId)
      .maybeSingle()
    if (loadErr) {
      Sentry.captureException(loadErr, {
        tags: { context: 'api/duel/join', phase: 'load-room' },
      })
      return NextResponse.json({ error: "Couldn't join duel" }, { status: 500 })
    }
    if (!room) return NextResponse.json({ error: 'Duel not found' }, { status: 404 })

    if (user.id === room.creator_id) {
      return NextResponse.json({ error: 'self_join' }, { status: 409 })
    }
    if (room.lang !== expectedLang) {
      return NextResponse.json(
        { error: 'lang_mismatch', expected: room.lang, got: expectedLang },
        { status: 409 },
      )
    }
    if (isExpired(room.expires_at)) {
      return NextResponse.json({ error: 'expired' }, { status: 410 })
    }

    // Pitfall 5: dup-join is a 200, not 409. onConflict on composite PK.
    const { error: upsertErr } = await supabaseAdmin
      .from('room_players')
      .upsert(
        { room_id: room.id, user_id: user.id, role: 'joiner' },
        { onConflict: 'room_id,user_id', ignoreDuplicates: true },
      )
    if (upsertErr) {
      Sentry.captureException(upsertErr, {
        tags: { context: 'api/duel/join', phase: 'upsert-player' },
      })
      return NextResponse.json({ error: "Couldn't join duel" }, { status: 500 })
    }

    return NextResponse.json({ roomId: room.id, role: 'joiner', lang: room.lang })
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'api/duel/join' } })
    return NextResponse.json({ error: "Couldn't join duel" }, { status: 500 })
  }
}
