import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchLinkedArticle } from '@/lib/wikipedia'
import { fetchRandomQualityArticle } from '@/lib/wikipedia-seed'
import { wordsMatch, splitOnApostrophe, cleanTokenValue, normalize } from '@/lib/matching'
import { tokenizeContent, tokenizeTitle, maskTokensForClient, maskTitleForClient } from '@/lib/tokenize'
import { findProximityHints } from '@/lib/proximity'
import { createHash } from 'crypto'
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
  const lang = searchParams.get('lang') as 'fr' | 'en' || 'fr'
  let targetDate = searchParams.get('date')
  const gameId = searchParams.get('gameId')

  if (!targetDate) {
    targetDate = new Date().toISOString().split('T')[0]
  }

  // 1. Récupération de l'article depuis la base de données
  let { data: page, error } = await supabaseAdmin
    .from('pages')
    .select('id, date, wikipedia_title_fr, wikipedia_title_en, wikipedia_url_fr, wikipedia_url_en, content_fr, content_en, tokens_fr, tokens_en, title_tokens_fr, title_tokens_en, word_count_fr, word_count_en')
    .eq('date', targetDate)
    .single()

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

  // 3. Génère un hash set des mots de l'article pour vérification instantanée côté client
  const wordHashSet: string[] = []
  const seenHashes = new Set<string>()
  for (const token of fullTokens) {
    if (token.type !== 'word' || token.isStopword) continue
    const norm = normalize(cleanTokenValue(token.value))
    const hash = createHash('sha256').update(norm).digest('hex').slice(0, 16)
    if (!seenHashes.has(hash)) {
      seenHashes.add(hash)
      wordHashSet.push(hash)
    }
  }
  for (const tw of fullTitleTokens) {
    if (!tw.isWord || tw.isStopword) continue
    const norm = normalize(tw.value)
    const hash = createHash('sha256').update(norm).digest('hex').slice(0, 16)
    if (!seenHashes.has(hash)) {
      seenHashes.add(hash)
      wordHashSet.push(hash)
    }
  }

  // 4. Masquer les valeurs pour le client
  const tokens = maskTokensForClient(fullTokens)
  const titleWords = maskTitleForClient(fullTitleTokens)

  // 4. Si un gameId est fourni, révéler les mots déjà devinés
  let firstGuessAt: string | null = null
  if (gameId) {
    const { data: guesses } = await supabaseAdmin
      .from('guesses')
      .select('word, guessed_at')
      .eq('game_id', gameId)
      .order('guessed_at', { ascending: true })

    const previousWords = (guesses || []).map((g: any) => g.word)
    if (guesses && guesses.length > 0) {
      firstGuessAt = (guesses[0] as GuessRow).guessed_at
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

  // 5. Calcule les proximity hints pour la restauration
  let restoredProximityHints: { index: number; score: number; word: string }[] = []
  if (gameId) {
    const revealedIndices = new Set(
      tokens.filter((t: any) => t.type === 'word' && t.visible && !t.isStopword).map((t: any) => t.index)
    )
    const unrevealed = fullTokens.filter((t: any) =>
      t.type === 'word' && !t.isStopword && !revealedIndices.has(t.index)
    )

    const { data: guessRows } = await supabaseAdmin
      .from('guesses')
      .select('word')
      .eq('game_id', gameId)
      .order('guessed_at', { ascending: true })

    const previousWords = (guessRows || []).map((g: any) => g.word)
    const hintsMap = new Map<number, { score: number; word: string }>()

    for (const w of previousWords) {
      const hints = findProximityHints(w, unrevealed)
      for (const h of hints) {
        if (!hintsMap.has(h.index) || hintsMap.get(h.index)!.score < h.score) {
          hintsMap.set(h.index, { score: h.score, word: w })
        }
      }
    }

    restoredProximityHints = Array.from(hintsMap.entries()).map(([index, { score, word }]) => ({
      index, score, word,
    }))
  }

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
      proximityHints: restoredProximityHints,
      firstGuessAt,
      wordHashSet,
    },
    { headers: { 'Cache-Control': cacheControl } }
  )
}