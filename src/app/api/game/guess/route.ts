import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { wordsMatch, splitOnApostrophe, cleanTokenValue } from '@/lib/matching'
import { tokenizeContent, tokenizeTitle } from '@/lib/tokenize'
import { checkWordExists } from '@/lib/wiktionary-cache'
import { evaluateBadges } from '@/lib/badges'
import { calculateRankedScore, updateSeasonScore } from '@/lib/seasons'
import { parseJsonBody, UuidSchema, LangSchema, GuessWordSchema } from '@/lib/validation'

// Schéma plat — hot path, < 1ms à parser
const GuessBodySchema = z.object({
  gameId: UuidSchema.nullable().optional(),
  pageId: UuidSchema,
  lang: LangSchema,
  word: GuessWordSchema,
  elapsed: z.number().int().nonnegative().nullable().optional(),
  previousGuesses: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, GuessBodySchema)
  if ('error' in parsed) return parsed.error
  const { gameId, pageId, lang, word, elapsed, previousGuesses: clientPreviousGuesses } = parsed.data

  // Authentification + chargement article en parallèle
  const [authResult, pageResult, rankedPageResult] = await Promise.all([
    (async () => {
      const supabase = await createSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      return user
    })(),
    supabaseAdmin
      .from('pages')
      .select('wikipedia_title_fr, wikipedia_title_en, content_fr, content_en, tokens_fr, tokens_en, title_tokens_fr, title_tokens_en')
      .eq('id', pageId)
      .single(),
    supabaseAdmin
      .from('ranked_pages')
      .select('lang, wikipedia_title, content, tokens, title_tokens')
      .eq('id', pageId)
      .single(),
  ])

  const user = authResult
  // Cherche d'abord dans pages (quotidien), sinon dans ranked_pages (classé)
  let page = pageResult.data
  let isRankedPage = false
  if (!page && rankedPageResult.data) {
    const rp = rankedPageResult.data as any
    // Adapte le format ranked_pages pour matcher le format pages
    page = {
      wikipedia_title_fr: rp.lang === 'fr' ? rp.wikipedia_title : rp.wikipedia_title,
      wikipedia_title_en: rp.lang === 'en' ? rp.wikipedia_title : rp.wikipedia_title,
      content_fr: rp.lang === 'fr' ? rp.content : rp.content,
      content_en: rp.lang === 'en' ? rp.content : rp.content,
      tokens_fr: rp.lang === 'fr' ? rp.tokens : rp.tokens,
      tokens_en: rp.lang === 'en' ? rp.tokens : rp.tokens,
      title_tokens_fr: rp.lang === 'fr' ? rp.title_tokens : rp.title_tokens,
      title_tokens_en: rp.lang === 'en' ? rp.title_tokens : rp.title_tokens,
    }
    isRankedPage = true
  }

  // Si gameId fourni, vérifier la propriété et l'état
  let serverGuessCount: number | null = null
  let bonusMode = false
  if (gameId && user) {
    const { data: game } = await supabaseAdmin
      .from('games')
      .select('id, user_id, completed, guess_count')
      .eq('id', gameId)
      .single()

    if (!game || game.user_id !== user.id) {
      return NextResponse.json({ error: 'Partie introuvable' }, { status: 403 })
    }

    bonusMode = game.completed

    if (bonusMode) {
      serverGuessCount = game.guess_count
    }
  }

  if (!page) {
    return NextResponse.json({ error: 'Page introuvable' }, { status: 404 })
  }

  const title = lang === 'fr' ? page.wikipedia_title_fr : page.wikipedia_title_en
  const content = lang === 'fr' ? page.content_fr : page.content_en

  // Matching côté serveur (utilise les tokens pré-calculés si disponibles)
  const variants = splitOnApostrophe(word)
  const preTokens = lang === 'fr' ? page.tokens_fr : page.tokens_en
  const preTitleTokens = lang === 'fr' ? page.title_tokens_fr : page.title_tokens_en
  const tokens: any[] = preTokens || tokenizeContent(content, lang)
  const titleTokens: any[] = preTitleTokens || tokenizeTitle(title, lang)

  // Trouve les tokens du contenu révélés par ce mot
  const revealedTokens: { index: number; value: string }[] = []
  let isInText = false

  for (const token of tokens) {
    if (token.type !== 'word' || token.isStopword) continue
    const tokenClean = cleanTokenValue(token.value)
    if (variants.some(v => wordsMatch(v, tokenClean))) {
      revealedTokens.push({ index: token.index, value: token.value })
      isInText = true
    }
  }

  // Si le mot n'est pas dans le texte, vérifier s'il existe dans le dictionnaire (avec cache)
  if (!isInText) {
    const exists = await checkWordExists(word, lang)
    if (!exists) {
      return NextResponse.json({
        isInText: false,
        revealedTokens: [],
        revealedTitleIndices: [],
        won: false,
        guessCount: serverGuessCount,
        proximityHints: [],
        wordNotFound: true,
      })
    }
  }

  // Enregistre le guess en base (après vérification Wiktionary)
  if (gameId && user && !bonusMode) {
    await supabaseAdmin.from('guesses').insert({ game_id: gameId, word })
    const { count } = await supabaseAdmin
      .from('guesses')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId)
    serverGuessCount = count || 0
  } else if (gameId && user && bonusMode) {
    await supabaseAdmin.from('guesses').insert({ game_id: gameId, word })
  }

  // Trouve les mots du titre révélés par ce mot
  const revealedTitleIndices: { index: number; value: string }[] = []
  for (const tw of titleTokens) {
    if (!tw.isWord || tw.isStopword) continue
    if (variants.some(v => wordsMatch(v, tw.value))) {
      revealedTitleIndices.push({ index: tw.index, value: tw.value })
    }
  }

  // Vérifie si tous les mots du titre sont trouvés (victoire)
  // Il faut savoir quels mots étaient déjà révélés — on charge les guesses précédentes
  let won = false
  if (revealedTitleIndices.length > 0 || isInText) {
    const nonStopTitleWords = titleTokens.filter(tw => tw.isWord && !tw.isStopword)

    if (gameId && user) {
      // Charge tous les guesses précédents pour vérifier la victoire
      const { data: allGuesses } = await supabaseAdmin
        .from('guesses')
        .select('word')
        .eq('game_id', gameId)

      const allWords = (allGuesses || []).map((g: any) => g.word)
      const allVariants = allWords.flatMap(splitOnApostrophe)

      won = nonStopTitleWords.every(tw =>
        allVariants.some(v => wordsMatch(v, tw.value))
      )
    } else {
      // Anonyme : utilise les guesses précédents envoyés par le client + le guess courant
      const anonPrevious: string[] = Array.isArray(clientPreviousGuesses) ? clientPreviousGuesses : []
      const allAnonVariants = [...anonPrevious, word].flatMap(splitOnApostrophe)
      won = nonStopTitleWords.every(tw =>
        allAnonVariants.some(v => wordsMatch(v, tw.value))
      )
    }
  }

  // Met à jour la partie (sauf en mode bonus — la partie est déjà complétée)
  if (!bonusMode && gameId && user && serverGuessCount !== null) {
    if (won) {
      await supabaseAdmin.from('games').update({
        guess_count: serverGuessCount,
        completed: true,
        completed_at: new Date().toISOString(),
        duration_seconds: elapsed || null,
      }).eq('id', gameId)
    } else {
      await supabaseAdmin.from('games').update({
        guess_count: serverGuessCount,
      }).eq('id', gameId)
    }
  }

  // Évalue les badges et le score saisonnier après une victoire
  let newBadges: any[] = []
  let seasonUpdate: { seasonName: string; totalScore: number; rank: string; rankedScore: number } | null = null
  if (won && user && !bonusMode) {
    newBadges = await evaluateBadges(user.id)

    // Score classé saisonnier — uniquement pour les parties classées (ranked_pages)
    if (isRankedPage) {
      const rankedScore = calculateRankedScore(
        serverGuessCount || 0,
        true,
        elapsed || null,
      )
      const result = await updateSeasonScore(user.id, rankedScore, elapsed || null)
      if (result) {
        seasonUpdate = { ...result, rankedScore }
      }
    }
  }

  return NextResponse.json({
    isInText,
    revealedTokens,
    revealedTitleIndices,
    won,
    newBadges: newBadges.map(b => ({ key: b.key, name: b.name, nameEn: b.nameEn, icon: b.icon, rarity: b.rarity })),
    seasonUpdate,
    guessCount: serverGuessCount,
  })
}
