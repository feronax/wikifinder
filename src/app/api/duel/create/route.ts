import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseJsonBody, DuelCreateSchema } from '@/lib/validation'
import { acquireIdempotencySlot } from '@/lib/idempotency'

// Phase 4 Plan 03 — POST /api/duel/create
// MP-02: mint a multiplayer_rooms row + enroll creator in room_players, idempotent re-tap.
// expires_at anchored to UTC end-of-day (D-05).

type CreateResponse = { roomId: string; duelUrl: string }

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, DuelCreateSchema)
  if ('error' in parsed) return parsed.error
  const { lang, idempotencyKey } = parsed.data

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

    const slot = idempotencyKey
      ? await acquireIdempotencySlot<CreateResponse>(user.id, idempotencyKey)
      : null
    if (slot && slot.kind === 'replay') return NextResponse.json(slot.response)

    const today = new Date().toISOString().slice(0, 10)
    const { data: page } = await supabaseAdmin
      .from('pages').select('id').eq('date', today).maybeSingle()
    if (!page) return NextResponse.json({ error: 'No daily article' }, { status: 404 })

    const now = new Date()
    const expiresAt = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
    )).toISOString()

    const { data: room, error: insErr } = await supabaseAdmin
      .from('multiplayer_rooms')
      .insert({ creator_id: user.id, page_id: page.id, lang, expires_at: expiresAt })
      .select('id').single()
    if (insErr || !room) {
      Sentry.captureException(insErr ?? new Error('room insert returned no row'), {
        tags: { context: 'api/duel/create', phase: 'insert-room' },
      })
      return NextResponse.json({ error: "Couldn't create duel" }, { status: 500 })
    }

    const { error: rpErr } = await supabaseAdmin
      .from('room_players').insert({ room_id: room.id, user_id: user.id, role: 'creator' })
    if (rpErr) {
      Sentry.captureException(rpErr, {
        tags: { context: 'api/duel/create', phase: 'insert-creator' },
      })
      return NextResponse.json({ error: "Couldn't create duel" }, { status: 500 })
    }

    const body: CreateResponse = { roomId: room.id, duelUrl: `/duel/${room.id}` }
    if (slot && slot.kind === 'fresh') await slot.commit(body)
    return NextResponse.json(body)
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'api/duel/create' } })
    return NextResponse.json({ error: "Couldn't create duel" }, { status: 500 })
  }
}
