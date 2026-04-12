import { supabaseAdmin } from './supabase-admin'
import { calculateScore } from './scoring'
import { getRankFromScore } from './badges'

/**
 * Calcule le score classé d'une partie :
 * Score base × Bonus temps
 */
export function calculateRankedScore(guessCount: number, completed: boolean, durationSeconds: number | null): number {
  const baseScore = calculateScore(guessCount, completed)
  if (baseScore === 0) return 0

  // Bonus temps : plus c'est rapide, plus le bonus est élevé
  let timeMultiplier = 1.0
  if (durationSeconds && durationSeconds > 0) {
    if (durationSeconds < 120) timeMultiplier = 1.3       // < 2 min
    else if (durationSeconds < 300) timeMultiplier = 1.15  // < 5 min
    else if (durationSeconds < 600) timeMultiplier = 1.05  // < 10 min
    // > 10 min = ×1.0
  }

  return Math.round(baseScore * timeMultiplier)
}

/**
 * Récupère la saison active
 */
export async function getActiveSeason(): Promise<{ id: number; name: string; starts_at: string; ends_at: string } | null> {
  const { data } = await supabaseAdmin
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .single()
  return data
}

/**
 * Met à jour le score saisonnier d'un joueur après une victoire
 */
export async function updateSeasonScore(
  userId: string,
  rankedScore: number,
  durationSeconds: number | null
): Promise<{ seasonName: string; totalScore: number; rank: string } | null> {
  const season = await getActiveSeason()
  if (!season) return null

  // Récupère ou crée le score saisonnier
  const { data: existing } = await supabaseAdmin
    .from('season_scores')
    .select('*')
    .eq('user_id', userId)
    .eq('season_id', season.id)
    .single()

  const newTotal = (existing?.total_score || 0) + rankedScore
  const newTime = (existing?.total_time_seconds || 0) + (durationSeconds || 0)
  const newGames = (existing?.games_played || 0) + 1
  const newRank = getRankFromScore(newTotal)

  if (existing) {
    await supabaseAdmin
      .from('season_scores')
      .update({
        total_score: newTotal,
        total_time_seconds: newTime,
        games_played: newGames,
        rank: newRank.key,
      })
      .eq('id', existing.id)
  } else {
    await supabaseAdmin
      .from('season_scores')
      .insert({
        user_id: userId,
        season_id: season.id,
        total_score: newTotal,
        total_time_seconds: newTime,
        games_played: newGames,
        rank: newRank.key,
      })
  }

  return {
    seasonName: season.name,
    totalScore: newTotal,
    rank: newRank.key,
  }
}
