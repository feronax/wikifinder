import { supabaseAdmin } from './supabase-admin'
import { calculateScore } from './scoring'

export type BadgeRarity = 'bronze' | 'silver' | 'gold'

export type BadgeDefinition = {
  key: string
  name: string
  nameEn: string
  description: string
  descriptionEn: string
  rarity: BadgeRarity
  icon: string
}

export const BADGES: BadgeDefinition[] = [
  // Bronze
  { key: 'first_win', name: 'Premier pas', nameEn: 'First step', description: 'Terminer sa première partie', descriptionEn: 'Complete your first game', rarity: 'bronze', icon: '👣' },
  { key: 'word_master', name: 'Mot juste', nameEn: 'Right word', description: 'Trouver le titre en moins de 30 tentatives', descriptionEn: 'Find the title in under 30 guesses', rarity: 'bronze', icon: '💬' },
  { key: 'bilingual', name: 'Bilingue', nameEn: 'Bilingual', description: 'Gagner une partie en FR et une en EN (articles différents)', descriptionEn: 'Win a game in FR and one in EN (different articles)', rarity: 'bronze', icon: '🌐' },
  { key: 'explorer', name: 'Explorateur', nameEn: 'Explorer', description: 'Révéler 50% d\'un article avant de gagner', descriptionEn: 'Reveal 50% of an article before winning', rarity: 'bronze', icon: '🔍' },
  { key: 'scholar', name: 'Encyclopédiste', nameEn: 'Scholar', description: 'Jouer 10 parties', descriptionEn: 'Play 10 games', rarity: 'bronze', icon: '📚' },
  { key: 'challenger', name: 'Challenger', nameEn: 'Challenger', description: 'Défier un ami', descriptionEn: 'Challenge a friend', rarity: 'bronze', icon: '⚔️' },
  { key: 'streak_3', name: 'Flamme', nameEn: 'Flame', description: 'Streak de 3 jours', descriptionEn: '3-day streak', rarity: 'bronze', icon: '🔥' },

  // Silver
  { key: 'sherlock', name: 'Sherlock', nameEn: 'Sherlock', description: 'Trouver le titre en moins de 15 tentatives', descriptionEn: 'Find the title in under 15 guesses', rarity: 'silver', icon: '🕵️' },
  { key: 'streak_7', name: 'Brasier', nameEn: 'Blaze', description: 'Streak de 7 jours', descriptionEn: '7-day streak', rarity: 'silver', icon: '🔥' },
  { key: 'veteran', name: 'Vétéran', nameEn: 'Veteran', description: 'Jouer 50 parties', descriptionEn: 'Play 50 games', rarity: 'silver', icon: '🎖️' },
  { key: 'speedrunner', name: 'Speedrunner', nameEn: 'Speedrunner', description: 'Gagner en moins de 2 minutes', descriptionEn: 'Win in under 2 minutes', rarity: 'silver', icon: '⚡' },

  // Gold
  { key: 'genius', name: 'Génie', nameEn: 'Genius', description: 'Score parfait (5000 pts)', descriptionEn: 'Perfect score (5000 pts)', rarity: 'gold', icon: '🧠' },
  { key: 'streak_30', name: 'Inferno', nameEn: 'Inferno', description: 'Streak de 30 jours', descriptionEn: '30-day streak', rarity: 'gold', icon: '🌋' },
  { key: 'legend', name: 'Légende', nameEn: 'Legend', description: 'Jouer 100 parties', descriptionEn: 'Play 100 games', rarity: 'gold', icon: '👑' },
]

export const BADGE_MAP = new Map(BADGES.map(b => [b.key, b]))

export const RARITY_COLORS: Record<BadgeRarity, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
}

/**
 * Évalue et attribue les badges après une action (victoire, etc.)
 * Retourne les nouveaux badges débloqués
 */
export async function evaluateBadges(userId: string): Promise<BadgeDefinition[]> {
  // Récupère les badges existants
  const { data: existing } = await supabaseAdmin
    .from('badges')
    .select('badge_key')
    .eq('user_id', userId)

  const owned = new Set((existing || []).map((b: any) => b.badge_key))

  // Récupère les données du joueur
  const { data: games } = await supabaseAdmin
    .from('games')
    .select('id, guess_count, completed, duration_seconds, lang, page_id')
    .eq('user_id', userId)

  if (!games) return []

  const completedGames = games.filter((g: any) => g.completed)
  const totalGames = games.length

  const newBadges: BadgeDefinition[] = []

  async function tryGrant(key: string) {
    if (owned.has(key)) return
    const badge = BADGE_MAP.get(key)
    if (!badge) return
    await supabaseAdmin.from('badges').insert({ user_id: userId, badge_key: key }).select()
    owned.add(key)
    newBadges.push(badge)
  }

  // first_win: première partie complétée
  if (completedGames.length >= 1) await tryGrant('first_win')

  // word_master: titre en moins de 30 tentatives
  if (completedGames.some((g: any) => g.guess_count < 30)) await tryGrant('word_master')

  // sherlock: titre en moins de 15 tentatives
  if (completedGames.some((g: any) => g.guess_count < 15)) await tryGrant('sherlock')

  // genius: score parfait 5000
  if (completedGames.some((g: any) => calculateScore(g.guess_count, true) >= 5000)) await tryGrant('genius')

  // speedrunner: gagner en moins de 2 minutes (120 sec)
  if (completedGames.some((g: any) => g.duration_seconds && g.duration_seconds < 120)) await tryGrant('speedrunner')

  // scholar: 10 parties
  if (totalGames >= 10) await tryGrant('scholar')

  // veteran: 50 parties
  if (totalGames >= 50) await tryGrant('veteran')

  // legend: 100 parties
  if (totalGames >= 100) await tryGrant('legend')

  // bilingual: gagner en FR et EN sur des articles DIFFÉRENTS
  if (!owned.has('bilingual')) {
    const frWins = completedGames.filter((g: any) => g.lang === 'fr')
    const enWins = completedGames.filter((g: any) => g.lang === 'en')
    if (frWins.length > 0 && enWins.length > 0) {
      // Vérifie que ce ne sont pas les mêmes articles
      const frPageIds = new Set(frWins.map((g: any) => g.page_id))
      const hasDistinct = enWins.some((g: any) => !frPageIds.has(g.page_id))
      if (hasDistinct) await tryGrant('bilingual')
    }
  }

  // streaks
  if (!owned.has('streak_3') || !owned.has('streak_7') || !owned.has('streak_30')) {
    const { data: streakGames } = await supabaseAdmin
      .from('games')
      .select('completed, pages(date)')
      .eq('user_id', userId)
      .eq('completed', true)

    if (streakGames && streakGames.length > 0) {
      const dates = [...new Set(
        streakGames.map((g: any) => g.pages?.date).filter(Boolean)
      )].sort((a: string, b: string) => b.localeCompare(a))

      let bestStreak = 1
      let current = 1
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1])
        const curr = new Date(dates[i])
        const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
        if (diff === 1) {
          current++
          bestStreak = Math.max(bestStreak, current)
        } else {
          current = 1
        }
      }

      if (bestStreak >= 3) await tryGrant('streak_3')
      if (bestStreak >= 7) await tryGrant('streak_7')
      if (bestStreak >= 30) await tryGrant('streak_30')
    }
  }

  return newBadges
}

/**
 * Vérifie le badge "explorer" — appelé quand le joueur révèle 50% de l'article
 * Ne s'applique que si la partie n'est PAS encore gagnée
 */
export async function checkExplorerBadge(userId: string, gameId: string, revealPercentage: number): Promise<BadgeDefinition | null> {
  if (revealPercentage < 50) return null

  const { data: existing } = await supabaseAdmin
    .from('badges')
    .select('id')
    .eq('user_id', userId)
    .eq('badge_key', 'explorer')
    .single()

  if (existing) return null

  // Vérifie que la partie n'est pas encore gagnée
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('completed')
    .eq('id', gameId)
    .single()

  if (game?.completed) return null

  await supabaseAdmin.from('badges').insert({ user_id: userId, badge_key: 'explorer' })
  return BADGE_MAP.get('explorer') || null
}
