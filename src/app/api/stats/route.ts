import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { calculateScore } from '@/lib/scoring'

export async function GET(req: NextRequest) {
  const usernameParam = req.nextUrl.searchParams.get('username')

  let userId: string

  if (usernameParam) {
    // Public profile lookup by username
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, username, favorite_badge, created_at')
      .eq('username', usernameParam)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Joueur introuvable' }, { status: 404 })
    }
    userId = profile.id

    // Récupère toutes les parties du joueur
    const { data: games, error } = await supabaseAdmin
      .from('games')
      .select('id, guess_count, completed, completed_at, pages(date)')
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = computeStats(games || [])
    return NextResponse.json({
      ...result,
      userId,
      username: profile.username,
      favoriteBadge: profile.favorite_badge || null,
      memberSince: profile.created_at,
    })
  }

  // Authenticated user stats (original behavior)
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  }

  // Récupère toutes les parties du joueur
  const { data: games, error } = await supabaseAdmin
    .from('games')
    .select('id, guess_count, completed, completed_at, pages(date)')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(computeStats(games || []))
}

function computeStats(games: any[]) {
  if (!games || games.length === 0) {
    return {
      totalGames: 0,
      totalWins: 0,
      winRate: 0,
      avgGuesses: 0,
      bestScore: 0,
      avgScore: 0,
      streak: 0,
      bestStreak: 0,
      distribution: {},
    }
  }

  const completedGames = games.filter((g: any) => g.completed)
  const totalGames = games.length
  const totalWins = completedGames.length
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0

  const guessCountsWins = completedGames.map((g: any) => g.guess_count)
  const avgGuesses = guessCountsWins.length > 0
    ? Math.round(guessCountsWins.reduce((a: number, b: number) => a + b, 0) / guessCountsWins.length)
    : 0

  const scores = completedGames.map((g: any) => calculateScore(g.guess_count, true))
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
    : 0

  const distribution: Record<string, number> = {
    '1-50': 0,
    '51-100': 0,
    '101-150': 0,
    '151-200': 0,
    '201-300': 0,
    '300+': 0,
  }
  for (const g of completedGames) {
    const gc = (g as any).guess_count
    if (gc <= 50) distribution['1-50']++
    else if (gc <= 100) distribution['51-100']++
    else if (gc <= 150) distribution['101-150']++
    else if (gc <= 200) distribution['151-200']++
    else if (gc <= 300) distribution['201-300']++
    else distribution['300+']++
  }

  const dates = [...new Set(
    completedGames
      .map((g: any) => g.pages?.date)
      .filter(Boolean)
  )].sort((a: string, b: string) => b.localeCompare(a))

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  let streak = 0
  if (dates.length > 0 && (dates[0] === today || dates[0] === yesterday)) {
    streak = 1
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1])
      const curr = new Date(dates[i])
      const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
      if (diff === 1) streak++
      else break
    }
  }

  let bestStreakVal = dates.length > 0 ? 1 : 0
  let currentBest = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1])
    const curr = new Date(dates[i])
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
    if (diff === 1) {
      currentBest++
      bestStreakVal = Math.max(bestStreakVal, currentBest)
    } else {
      currentBest = 1
    }
  }

  return {
    totalGames,
    totalWins,
    winRate,
    avgGuesses,
    bestScore,
    avgScore,
    streak,
    bestStreak: bestStreakVal,
    distribution,
  }
}
