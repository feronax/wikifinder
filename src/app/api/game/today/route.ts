import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchLinkedArticle } from '@/lib/wikipedia'
import { fetchRandomQualityArticle } from '@/lib/wikipedia-seed'
import { wordsMatch, splitOnApostrophe, cleanTokenValue } from '@/lib/matching'
import { computeWordHashSet } from '@/lib/client-hash'
import { tokenizeContent, tokenizeTitle, maskTokensForClient, maskTitleForClient } from '@/lib/tokenize'
import type { GuessRow } from '@/lib/wikipedia-types'

async function seedPage(date: string) {
  const { data: usedPages } = await supabaseAdmin
    .from('pages')
    .select('wikipedia_title_fr')

  const alreadyUsedTitles = (usedPages || [])
    .map((p: { wikipedia_title_fr?: string }) => p.wikipedia_title_fr)
    .filter((title): title is string => Boolean(title))

  const MAX_RETRIES = 5
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const frArticle = await fetchRandomQualityArticle('fr', alreadyUsedTitles)
    const enArticle = await fetchLinkedArticle(frArticle.title, 'fr')

    if (!enArticle || enArticle.wordCount < 800) {
      alreadyUsedTitles.push(frArticle.title)
      continue
    }

    const { data, error } = await supabaseAdmin.from('pages').insert({
      date,
      wikipedia_title_fr: frArticle.title,
      wikipedia_title_en: enArticle.title,
      wikipedia_url_fr: frArticle.url,
      wikipedia_url_en: enArticle.url,
      content_fr: frArticle.content,
      content_en: enArticle.content,
      word_count_fr: frArticle.wordCount,
      word_count_en: enArticle.wordCount,
      tokens_fr: tokenizeContent(frArticle.content, 'fr'),
      tokens_en: tokenizeContent(enArticle.content, 'en'),
      title_tokens_fr: tokenizeTitle(frArticle.title, 'fr'),
      title_tokens_en: tokenizeTitle(enArticle.title, 'en'),
    }).select().single()

    if (error) throw new Error(error.message)
    return data
  }

  throw new Error('Impossible de générer la page du jour')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  // Phase 20 WR-01: validate lang against enum instead of unsafe cast.
  const rawLang = searchParams.get('lang')
  const lang: 'fr' | 'en' = rawLang === 'en' ? 'en' : 'fr'
  let targetDate = searchParams.get('date')
  const gameId = searchParams.get('gameId')
  const pageIdParam = searchParams.get('pageId')

  if (!targetDate) {
    targetDate = new Date().toISOString().split('T')[0]
  }

  // 1. Récupération de l'article depuis la base de données
  // Phase 6 fix: allow ?pageId lookup for duels where the article may not be today's
  // daily (e.g. duel created near UTC day-boundary, joiner opens after rollover).
  let pageQuery = supabaseAdmin
    .from('pages')
    .select('id, date, wikipedia_title_fr, wikipedia_title_en, wikipedia_url_fr, wikipedia_url_en, content_fr, content_en, tokens_fr, tokens_en, title_tokens_fr, title_tokens_en, word_count_fr, word_count_en')
  pageQuery = pageIdParam ? pageQuery.eq('id', pageIdParam) : pageQuery.eq('date', targetDate)
  const pageRes = await pageQuery.single()
  let page = pageRes.data
  const error = pageRes.error

  // Si la page du jour n'existe pas (cron échoué), la générer automatiquement
  if ((error || !page) && targetDate === new Date().toISOString().split('T')[0]) {
    try {
      page = await seedPage(targetDate)
    } catch {
      return NextResponse.json({ error: 'Page non trouvée et génération impossible' }, { status: 500 })
    }
  }

  if (!page) {
    return NextResponse.json({ error: 'Page non trouvée' }, { status: 404 })
  }

  const title = lang === 'fr' ? page.wikipedia_title_fr : page.wikipedia_title_en
  const content = lang === 'fr' ? page.content_fr : page.content_en

  // 2. Utilise les tokens pré-calculés si disponibles, sinon tokenise à la volée
  const precomputedTokens = lang === 'fr' ? page.tokens_fr : page.tokens_en
  const precomputedTitleTokens = lang === 'fr' ? page.title_tokens_fr : page.title_tokens_en

  const fullTokens = precomputedTokens || tokenizeContent(content, lang)
  const fullTitleTokens = precomputedTitleTokens || tokenizeTitle(title, lang)

  // 3. Hash set des mots de l'article pour vérification instantanée côté client
  // Single source of truth: computeWordHashSet (Phase 22, HASH-CONSOLIDATE).
  const wordHashSet = computeWordHashSet(fullTokens, fullTitleTokens)

  // 4. Masquer les valeurs pour le client
  const tokens = maskTokensForClient(fullTokens)
  const titleWords = maskTitleForClient(fullTitleTokens)

  // 4. Si un gameId est fourni, révéler les mots déjà devinés
  // Phase 20 WR-02: hoist the guess fetch so it's reused for both reveal
  // and proximity computation — saves one Supabase round-trip per session
  // restore.
  let firstGuessAt: string | null = null
  let cachedGuesses: { word: string; guessed_at: string }[] = []
  if (gameId) {
    const { data: guesses } = await supabaseAdmin
      .from('guesses')
      .select('word, guessed_at')
      .eq('game_id', gameId)
      .order('guessed_at', { ascending: true })

    cachedGuesses = (guesses || []) as { word: string; guessed_at: string }[]
    const previousWords = cachedGuesses.map((g) => g.word)
    if (cachedGuesses.length > 0) {
      firstGuessAt = (cachedGuesses[0] as GuessRow).guessed_at
    }
    const allVariants = previousWords.flatMap(splitOnApostrophe)

    // Révèle les tokens du contenu qui matchent
    for (const token of tokens) {
      if (token.type !== 'word' || token.isStopword || token.visible) continue
      const realToken = fullTokens[token.index]
      if (!realToken) continue
      const tokenClean = cleanTokenValue(realToken.value)
      if (allVariants.some((v: string) => wordsMatch(v, tokenClean))) {
        token.value = realToken.value
        token.visible = true
      }
    }

    // Révèle les mots du titre
    for (const tw of titleWords) {
      if (tw.revealed) continue
      const realTw = fullTitleTokens[tw.index]
      if (!realTw) continue
      if (allVariants.some((v: string) => wordsMatch(v, realTw.value))) {
        tw.value = realTw.value
        tw.revealed = true
      }
    }
  }

  // 5. (proximity hints are now restored lazily client-side via /api/game/proximity
  //    to avoid blocking the restore path on large articles — WR-PERF-01)

  // 6. Cache CDN :
  //    - Sans gameId : réponse déterministe (lang, date, contenu de page) →
  //      publique, 60s frais + 120s stale. Économise la seed quotidienne et
  //      le hash-set sur les visites normales.
  //    - Avec gameId : réponse spécifique au joueur (guesses + proximity) →
  //      pas de cache.
  const cacheControl = gameId
    ? 'private, no-store'
    : 'public, s-maxage=60, stale-while-revalidate=120'

  return NextResponse.json(
    {
      id: page.id,
      date: page.date,
      titleWords,
      tokens,
      wikipedia_url_fr: page.wikipedia_url_fr,
      wikipedia_url_en: page.wikipedia_url_en,
      firstGuessAt,
      wordHashSet,
    },
    { headers: { 'Cache-Control': cacheControl } }
  )
}