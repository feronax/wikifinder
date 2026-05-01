import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { tokenizeContent, tokenizeTitle } from '@/lib/tokenize'
import { parseJsonBody, UuidSchema, LangSchema } from '@/lib/validation'

const RevealBodySchema = z.object({ pageId: UuidSchema, lang: LangSchema })

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, RevealBodySchema)
  if ('error' in parsed) return parsed.error
  const { pageId, lang } = parsed.data

  const { data: page } = await supabaseAdmin
    .from('pages')
    .select('content_fr, content_en, tokens_fr, tokens_en, title_tokens_fr, title_tokens_en, wikipedia_title_fr, wikipedia_title_en')
    .eq('id', pageId)
    .single()

  if (!page) {
    return NextResponse.json({ error: 'Page introuvable' }, { status: 404 })
  }

  const content = lang === 'fr' ? page.content_fr : page.content_en
  const precomputed = lang === 'fr' ? page.tokens_fr : page.tokens_en
  const fullTokens = precomputed || tokenizeContent(content, lang)

  // Renvoie tous les tokens du body avec leurs vraies valeurs
  const revealedAll = fullTokens
    .filter((t: any) => t.type === 'word' && !t.isStopword)
    .map((t: any) => ({ index: t.index, value: t.value }))

  // Title — same shape so the client can populate gameState.titleWords on
  // defeat ("Voir la solution"). Stopwords are already revealed client-side
  // (server masks only non-stopword title tokens), so we still return them
  // for completeness and let the client apply uniformly.
  const title = lang === 'fr' ? page.wikipedia_title_fr : page.wikipedia_title_en
  const precomputedTitleTokens = lang === 'fr' ? page.title_tokens_fr : page.title_tokens_en
  const fullTitleTokens = precomputedTitleTokens || tokenizeTitle(title, lang)
  const revealedTitleAll = fullTitleTokens
    .filter((tw: any) => tw.isWord && !tw.isStopword)
    .map((tw: any) => ({ index: tw.index, value: tw.value }))

  return NextResponse.json({ revealedAll, revealedTitleAll })
}
