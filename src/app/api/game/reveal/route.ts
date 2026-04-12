import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { tokenizeContent } from '@/lib/tokenize'

export async function POST(req: NextRequest) {
  const { pageId, lang } = await req.json()

  if (!pageId || !lang) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const { data: page } = await supabaseAdmin
    .from('pages')
    .select('content_fr, content_en, tokens_fr, tokens_en')
    .eq('id', pageId)
    .single()

  if (!page) {
    return NextResponse.json({ error: 'Page introuvable' }, { status: 404 })
  }

  const content = lang === 'fr' ? page.content_fr : page.content_en
  const precomputed = lang === 'fr' ? page.tokens_fr : page.tokens_en
  const fullTokens = precomputed || tokenizeContent(content, lang)

  // Renvoie tous les tokens avec leurs vraies valeurs
  const revealedAll = fullTokens
    .filter((t: any) => t.type === 'word' && !t.isStopword)
    .map((t: any) => ({ index: t.index, value: t.value }))

  return NextResponse.json({ revealedAll })
}
