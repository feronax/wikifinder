import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getRankFromScore } from '@/lib/badges'
import { getActiveSeason } from '@/lib/seasons'
import { seedRankedArticle } from '@/lib/ranked-seed'
import { maskTokensForClient, maskTitleForClient } from '@/lib/tokenize'
import { normalize } from '@/lib/matching'
import { variantsOf } from '@/lib/client-hash'
import { createHash } from 'crypto'
import { parseJsonBody, LangSchema } from '@/lib/validation'

const RankedStartBodySchema = z.object({ lang: LangSchema })

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, RankedStartBodySchema)
  if ('error' in parsed) return parsed.error
  const { lang } = parsed.data

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Connexion requise pour le mode classé' }, { status: 401 })
  }

  // Détermine la difficulté basée sur le rang du joueur
  const season = await getActiveSeason()
  let difficulty = 'bronze'

  if (season) {
    const { data: seasonScore } = await supabaseAdmin
      .from('season_scores')
      .select('total_score')
      .eq('user_id', user.id)
      .eq('season_id', season.id)
      .single()

    if (seasonScore) {
      const rank = getRankFromScore(seasonScore.total_score)
      difficulty = rank.key
    }
  }

  // Cherche un article classé disponible que le joueur n'a pas encore joué
  const { data: playedGames } = await supabaseAdmin
    .from('games')
    .select('page_id')
    .eq('user_id', user.id)

  const playedPageIds = new Set((playedGames || []).map((g: any) => g.page_id))

  let { data: availablePages } = await supabaseAdmin
    .from('ranked_pages')
    .select('id, lang, difficulty, wikipedia_title, wikipedia_url, tokens, title_tokens, used_count')
    .eq('lang', lang)
    .eq('difficulty', difficulty)
    .order('used_count', { ascending: true })
    .limit(10)

  // Filtre les pages déjà jouées
  let page = (availablePages || []).find((p: any) => !playedPageIds.has(p.id))

  // Si aucune page disponible, essaie de seeder
  if (!page) {
    const seeded = await seedRankedArticle(lang, difficulty)
    if (seeded) {
      const { data: newPage } = await supabaseAdmin
        .from('ranked_pages')
        .select('id, lang, difficulty, wikipedia_title, wikipedia_url, tokens, title_tokens, used_count')
        .eq('lang', lang)
        .eq('wikipedia_title', seeded.title)
        .single()
      page = newPage ?? undefined
    }
  }

  // Si toujours rien, fallback sur une difficulté inférieure
  if (!page) {
    const fallbackDiffs = ['bronze', 'silver', 'gold', 'platinum', 'diamond']
    const currentIdx = fallbackDiffs.indexOf(difficulty)
    for (let i = Math.max(0, currentIdx - 1); i >= 0; i--) {
      const { data: fallbackPages } = await supabaseAdmin
        .from('ranked_pages')
        .select('id, lang, difficulty, wikipedia_title, wikipedia_url, tokens, title_tokens, used_count')
        .eq('lang', lang)
        .eq('difficulty', fallbackDiffs[i])
        .order('used_count', { ascending: true })
        .limit(5)

      page = (fallbackPages || []).find((p: any) => !playedPageIds.has(p.id))
      if (page) break
    }
  }

  if (!page) {
    return NextResponse.json({
      error: lang === 'fr'
        ? 'Aucun article disponible. Réessaie plus tard.'
        : 'No article available. Try again later.',
    }, { status: 404 })
  }

  // Incrémente le compteur d'utilisation
  await supabaseAdmin
    .from('ranked_pages')
    .update({ used_count: (page.used_count || 0) + 1 })
    .eq('id', page.id)

  // Crée la partie
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const userAgent = req.headers.get('user-agent') || 'unknown'
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
  const browserHash = createHash('sha256').update(userAgent).digest('hex').slice(0, 16)

  const { data: game, error } = await supabaseAdmin
    .from('games')
    .insert({
      user_id: user.id,
      page_id: page.id,
      lang,
      guess_count: 0,
      completed: false,
      ip_hash: ipHash,
      browser_hash: browserHash,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Tokenise et masque pour le client
  const fullTokens = page.tokens || []
  const fullTitleTokens = page.title_tokens || []

  const tokens = maskTokensForClient(fullTokens)
  const titleWords = maskTitleForClient(fullTitleTokens)

  // Hash set pour le check client-side
  const wordHashSet: string[] = []
  const seenHashes = new Set<string>()
  for (const token of fullTokens) {
    if (token.type !== 'word' || token.isStopword) continue
    const norm = normalize(token.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, ''))
    for (const variant of variantsOf(norm)) {
      const hash = createHash('sha256').update(variant).digest('hex').slice(0, 16)
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash)
        wordHashSet.push(hash)
      }
    }
  }
  // Phase 20 CR-02: include title tokens so ranked-mode title-word guesses get
  // optimistic client-side reveal (mirrors game/today/route.ts).
  for (const tw of fullTitleTokens) {
    if (!tw.isWord || tw.isStopword) continue
    const norm = normalize(tw.value)
    for (const variant of variantsOf(norm)) {
      const hash = createHash('sha256').update(variant).digest('hex').slice(0, 16)
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash)
        wordHashSet.push(hash)
      }
    }
  }

  return NextResponse.json({
    gameId: game.id,
    pageId: page.id,
    difficulty,
    tokens,
    titleWords,
    wordHashSet,
    wikipedia_url: page.wikipedia_url,
  })
}
