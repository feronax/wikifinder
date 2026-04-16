import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { calculateScore } from '@/lib/scoring'
import { calculateRankedScore } from '@/lib/seasons'

type EnrichedGame = {
  id: string
  guess_count: number
  completed: boolean
  completed_at: string | null
  page_id: string
  duration_seconds: number | null
  mode: 'daily' | 'ranked'
  date: string | null // uniquement pour les parties quotidiennes
}

/**
 * Récupère les parties d'un joueur et les classe par mode.
 *
 * Requête en 2 étapes (plutôt qu'un join implicite `pages(date)`) car la
 * contrainte FK `games.page_id → pages.id` a été relâchée pour accepter aussi
 * des ids de `ranked_pages` — PostgREST ne peut plus résoudre le join
 * implicite.
 *
 * Une partie est considérée "daily" si son page_id existe dans `pages`,
 * "ranked" sinon (page_id pointe alors sur `ranked_pages`).
 */
async function fetchPlayerGames(userId: string): Promise<{ games: EnrichedGame[] | null; error: { message: string } | null }> {
  const { data: games, error: gamesErr } = await supabaseAdmin
    .from('games')
    .select('id, guess_count, completed, completed_at, page_id, duration_seconds')
    .eq('user_id', userId)

  if (gamesErr) {
    console.error('[api/stats] games query failed:', gamesErr)
    return { games: null, error: gamesErr }
  }

  const pageIds = [...new Set(
    (games || []).map((g: { page_id: string | null }) => g.page_id).filter(Boolean)
  )] as string[]

  let pageDateMap = new Map<string, string>()
  if (pageIds.length > 0) {
    const { data: pages, error: pagesErr } = await supabaseAdmin
      .from('pages')
      .select('id, date')
      .in('id', pageIds)

    if (pagesErr) {
      console.error('[api/stats] pages query failed:', pagesErr)
      return { games: null, error: pagesErr }
    }

    pageDateMap = new Map((pages || []).map((p: { id: string; date: string }) => [p.id, p.date]))
  }

  const enriched: EnrichedGame[] = (games || []).map((g: any) => ({
    id: g.id,
    guess_count: g.guess_count,
    completed: g.completed,
    completed_at: g.completed_at,
    page_id: g.page_id,
    duration_seconds: g.duration_seconds ?? null,
    mode: pageDateMap.has(g.page_id) ? 'daily' : 'ranked',
    date: pageDateMap.get(g.page_id) || null,
  }))

  return { games: enriched, error: null }
}

type ModeStats = {
  totalGames: number
  totalWins: number
  winRate: number
  avgGuesses: number
  bestScore: number
  avgScore: number
  distribution: Record<string, number>
}

type DailyStats = ModeStats & {
  streak: number
  bestStreak: number
}

const EMPTY_DIST = (): Record<string, number> => ({
  '1-50': 0,
  '51-100': 0,
  '101-150': 0,
  '151-200': 0,
  '201-300': 0,
  '300+': 0,
})

function computeDistribution(games: EnrichedGame[]): Record<string, number> {
  const dist = EMPTY_DIST()
  for (const g of games) {
    const gc = g.guess_count
    if (gc <= 50) dist['1-50']++
    else if (gc <= 100) dist['51-100']++
    else if (gc <= 150) dist['101-150']++
    else if (gc <= 200) dist['151-200']++
    else if (gc <= 300) dist['201-300']++
    else dist['300+']++
  }
  return dist
}

function computeModeCore(games: EnrichedGame[], scoreFn: (g: EnrichedGame) => number): ModeStats {
  if (games.length === 0) {
    return {
      totalGames: 0, totalWins: 0, winRate: 0,
      avgGuesses: 0, bestScore: 0, avgScore: 0,
      distribution: EMPTY_DIST(),
    }
  }

  const completed = games.filter(g => g.completed)
  const totalGames = games.length
  const totalWins = completed.length
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0

  const guessCounts = completed.map(g => g.guess_count)
  const avgGuesses = guessCounts.length > 0
    ? Math.round(guessCounts.reduce((a, b) => a + b, 0) / guessCounts.length)
    : 0

  const scores = completed.map(scoreFn)
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0

  return {
    totalGames, totalWins, winRate, avgGuesses, bestScore, avgScore,
    distribution: computeDistribution(completed),
  }
}

function computeDailyStats(allGames: EnrichedGame[]): DailyStats {
  const dailyGames = allGames.filter(g => g.mode === 'daily')
  const core = computeModeCore(dailyGames, g => calculateScore(g.guess_count, true))

  // Streak : consécutivité par date de page
  const dates = [...new Set(
    dailyGames.filter(g => g.completed && g.date).map(g => g.date as string)
  )].sort((a, b) => b.localeCompare(a))

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

  return { ...core, streak, bestStreak: bestStreakVal }
}

function computeRankedStats(allGames: EnrichedGame[]): ModeStats {
  const rankedGames = allGames.filter(g => g.mode === 'ranked')
  // Le score classé prend en compte la durée — on utilise calculateRankedScore.
  return computeModeCore(rankedGames, g => calculateRankedScore(g.guess_count, true, g.duration_seconds))
}

export async function GET(req: NextRequest) {
  const usernameParam = req.nextUrl.searchParams.get('username')

  if (usernameParam) {
    // Profil public par pseudo
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, username, favorite_badge, created_at')
      .eq('username', usernameParam)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Joueur introuvable' }, { status: 404 })
    }

    const { games, error } = await fetchPlayerGames(profile.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      daily: computeDailyStats(games || []),
      ranked: computeRankedStats(games || []),
      userId: profile.id,
      username: profile.username,
      favoriteBadge: profile.favorite_badge || null,
      memberSince: profile.created_at,
    })
  }

  // Stats du joueur connecté
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  }

  const { games, error } = await fetchPlayerGames(user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    daily: computeDailyStats(games || []),
    ranked: computeRankedStats(games || []),
  })
}
