import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { parseSearchParams, DateSchema } from '@/lib/validation'

// Phase 3: 'survival' queries leaderboard_survival view (MODE-02). 'global' is
// the existing Ranked leaderboard (no separate /api/leaderboard/ranked route —
// VERIFIED 2026-04-18).
const LeaderboardQuerySchema = z.object({
  type: z.enum(['daily', 'global', 'survival']).optional().default('daily'),
  date: DateSchema.optional(),
})

export async function GET(req: NextRequest) {
  const parsed = parseSearchParams(new URL(req.url), LeaderboardQuerySchema)
  if ('error' in parsed) return parsed.error
  const type = parsed.data.type
  const date = parsed.data.date || new Date().toISOString().split('T')[0]

  let data: any[] = []

  if (type === 'daily') {
    const { data: rows, error } = await supabaseAdmin
      .from('leaderboard_daily')
      .select('username, score, guess_count, duration_seconds, date, position, lang')
      .eq('date', date)
      .order('position', { ascending: true })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    data = rows || []
  } else if (type === 'global') {
    const { data: rows, error } = await supabaseAdmin
      .from('leaderboard_global')
      .select('username, score, guess_count, duration_seconds, position')
      .order('position', { ascending: true })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    data = rows || []
  } else if (type === 'survival') {
    // Phase 3 MODE-02: per-mode leaderboard; never mixed with daily/ranked (D-12).
    // SELECT list MUST match leaderboard_survival view columns exactly
    // (Pitfall 2: Phase 2.1 SC-1 recurrence guard).
    const { data: rows, error } = await supabaseAdmin
      .from('leaderboard_survival')
      .select('username, score, completed_at, lang, chain_length, position')
      .order('position', { ascending: true })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    data = rows || []
  } else {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }

  // Enrichit avec les badges favoris
  if (data.length > 0) {
    const usernames = data.map((d: any) => d.username)
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('username, favorite_badge')
      .in('username', usernames)

    if (profiles) {
      const badgeMap = new Map(profiles.map((p: any) => [p.username, p.favorite_badge]))
      data = data.map((entry: any) => ({
        ...entry,
        favorite_badge: badgeMap.get(entry.username) || null,
      }))
    }
  }

  // Cache CDN : 60s frais + 120s stale-while-revalidate.
  // Le leaderboard change au fil des victoires ; 60s est un bon compromis
  // entre fraîcheur perçue et charge DB.
  return NextResponse.json(
    { leaderboard: data },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
  )
}
