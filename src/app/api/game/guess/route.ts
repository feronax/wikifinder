import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { wordsMatch, splitOnApostrophe, cleanTokenValue } from '@/lib/matching'
import { tokenizeContent, tokenizeTitle } from '@/lib/tokenize'

export async function POST(req: NextRequest) {
  const { gameId, pageId, lang, word, previousGuesses: clientPreviousGuesses } = await req.json()

  if (!pageId || !lang || !word) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // Authentification (optionnelle — les anonymes peuvent jouer)
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Si gameId fourni, vérifier la propriété et l'état
  let serverGuessCount: number | null = null
  if (gameId && user) {
    const { data: game } = await supabaseAdmin
      .from('games')
      .select('id, user_id, completed')
      .eq('id', gameId)
      .single()

    if (!game || game.user_id !== user.id) {
      return NextResponse.json({ error: 'Partie introuvable' }, { status: 403 })
    }

    if (game.completed) {
      return NextResponse.json({ error: 'already_completed' }, { status: 409 })
    }

    // Enregistre la tentative
    await supabaseAdmin.from('guesses').insert({ game_id: gameId, word })

    const { count } = await supabaseAdmin
      .from('guesses')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId)

    serverGuessCount = count || 0
  }

  // Charge l'article depuis la base
  const { data: page } = await supabaseAdmin
    .from('pages')
    .select('wikipedia_title_fr, wikipedia_title_en, content_fr, content_en')
    .eq('id', pageId)
    .single()

  if (!page) {
    return NextResponse.json({ error: 'Page introuvable' }, { status: 404 })
  }

  const title = lang === 'fr' ? page.wikipedia_title_fr : page.wikipedia_title_en
  const content = lang === 'fr' ? page.content_fr : page.content_en

  // Matching côté serveur
  const variants = splitOnApostrophe(word)
  const tokens = tokenizeContent(content, lang)
  const titleTokens = tokenizeTitle(title, lang)

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

  // Si victoire, mettre à jour la partie
  if (won && gameId && user && serverGuessCount !== null) {
    await supabaseAdmin.from('games').update({
      guess_count: serverGuessCount,
      completed: true,
      completed_at: new Date().toISOString(),
    }).eq('id', gameId)
  } else if (gameId && user && serverGuessCount !== null) {
    await supabaseAdmin.from('games').update({
      guess_count: serverGuessCount,
    }).eq('id', gameId)
  }

  return NextResponse.json({
    isInText,
    revealedTokens,
    revealedTitleIndices,
    won,
    guessCount: serverGuessCount,
  })
}
