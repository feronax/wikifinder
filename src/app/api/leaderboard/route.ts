import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { parseSearchParams, DateSchema } from '@/lib/validation'

const LeaderboardQuerySchema = z.object({
  type: z.enum(['daily', 'global']).optional().default('daily'),
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
      .select('username, score, guess_count, duration_seconds, date, position')
      .eq('date', date)
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    data = rows || []
  } else if (type === 'global') {
    const { data: rows, error } = await supabaseAdmin
      .from('leaderboard_global')
      .select('username, score, guess_count, duration_seconds, position')
      .limit(20)

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
