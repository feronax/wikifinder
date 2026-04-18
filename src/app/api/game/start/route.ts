import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createHash } from 'crypto'
import { parseJsonBody, UuidSchema, LangSchema } from '@/lib/validation'

const StartBodySchema = z.object({ lang: LangSchema, pageId: UuidSchema })

export async function POST(req: NextRequest) {
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