import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { RANKS } from '@/lib/badges'

export async function GET() {
  // Récupère la saison active
  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!season) {
    return NextResponse.json({ error: 'Aucune saison active' }, { status: 404 })
  }

  // Classement saisonnier
  const { data: scores } = await supabaseAdmin
    .from('season_scores')
    .select('user_id, total_score, total_time_seconds, games_played, rank')
    .eq('season_id', season.id)
    .order('total_score', { ascending: false })
    .limit(50)

  if (!scores || scores.length === 0) {
    return NextResponse.json({
      season,
      leaderboard: [],
      ranks: RANKS,
    })
  }

  // Enrichit avec les usernames et badges favoris
  const userIds = scores.map((s: any) => s.user_id)
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, username, favorite_badge')
    .in('id', userIds)

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

  const leaderboard = scores.map((s: any, i: number) => {
    const profile = profileMap.get(s.user_id)
    return {
      position: i + 1,
      username: profile?.username || 'Anonyme',
      favorite_badge: profile?.favorite_badge || null,
      total_score: s.total_score,
      total_time_seconds: s.total_time_seconds,
      games_played: s.games_played,
      rank: s.rank,
    }
  })

  return NextResponse.json({
    season,
    leaderboard,
    ranks: RANKS,
  })
}
