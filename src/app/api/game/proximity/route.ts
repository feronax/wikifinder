import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { tokenizeContent } from '@/lib/tokenize'
import { findProximityHints } from '@/lib/proximity'
import { wordsMatch, cleanTokenValue, splitOnApostrophe } from '@/lib/matching'
import { parseJsonBody, UuidSchema, LangSchema, GuessWordSchema } from '@/lib/validation'

const ProximityBodySchema = z.object({
  pageId: UuidSchema,
  lang: LangSchema,
  word: GuessWordSchema,
  gameId: UuidSchema.nullable().optional(),
})

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, ProximityBodySchema)
  if ('error' in parsed) return parsed.error
  const { pageId, lang, word, gameId } = parsed.data

  // Charge la page (quotidien ou classé)
  let { data: page } = await supabaseAdmin
    .from('pages')
    .select('content_fr, content_en, tokens_fr, tokens_en')
    .eq('id', pageId)
    .single()

  let content: string
  let precomputed: any

  if (page) {
    content = lang === 'fr' ? page.content_fr : page.content_en
    precomputed = lang === 'fr' ? page.tokens_fr : page.tokens_en
  } else {
    // Essaie ranked_pages
    const { data: rankedPage } = await supabaseAdmin
      .from('ranked_pages')
      .select('content, tokens')
      .eq('id', pageId)
      .single()

    if (!rankedPage) {
      return NextResponse.json({ proximityHints: [] })
    }
    content = (rankedPage as any).content
    precomputed = (rankedPage as any).tokens
  }

  const fullTokens = precomputed || tokenizeContent(content, lang)

  // Trouve les tokens déjà révélés (pour ne pas les inclure dans les hints)
  let revealedIndices = new Set<number>()
  if (gameId) {
    const { data: guesses } = await supabaseAdmin
      .from('guesses')
      .select('word')
      .eq('game_id', gameId)

    const allVariants = (guesses || []).flatMap((g: any) => splitOnApostrophe(g.word))
    for (const token of fullTokens) {
      if (token.type !== 'word' || token.isStopword) continue
      const tokenClean = cleanTokenValue(token.value)
      if (allVariants.some((v: string) => wordsMatch(v, tokenClean))) {
        revealedIndices.add(token.index)
      }
    }
  }

  const unrevealed = fullTokens.filter((t: any) =>
    t.type === 'word' && !t.isStopword && !revealedIndices.has(t.index)
  )

  const proximityHints = findProximityHints(word, unrevealed)

  return NextResponse.json({ proximityHints })
}
