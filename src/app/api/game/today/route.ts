import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { extractWords, isStopword } from '@/lib/wikipedia'

export async function GET(req: NextRequest) {
  const lang = (req.nextUrl.searchParams.get('lang') || 'fr') as 'fr' | 'en'
  const today = new Date().toISOString().split('T')[0]

  const { data: page, error } = await supabaseAdmin
    .from('pages')
    .select('*')
    .eq('date', today)
    .single()

  if (error || !page) {
    return NextResponse.json(
      { error: "Aucune page disponible pour aujourd'hui" },
      { status: 404 }
    )
  }

  const content = lang === 'fr' ? page.content_fr : page.content_en
  const title = lang === 'fr' ? page.wikipedia_title_fr : page.wikipedia_title_en

  // Construit les mots du titre
  const titleWords = extractWords(title).map(w => ({
    value: w,
    isStopword: isStopword(w, lang),
    revealed: false,
  }))

  const titleWordsClean = titleWords
    .filter(tw => !tw.isStopword)
    .map(tw => tw.value.toLowerCase())

  // Construit les tokens du texte
  const tokens = buildTokens(content, lang, titleWordsClean)

  return NextResponse.json({
    id: page.id,
    date: page.date,
    lang,
    tokens,
    titleWords,
    wordCount: lang === 'fr' ? page.word_count_fr : page.word_count_en,
  })
}

function buildTokens(content: string, lang: 'fr' | 'en', titleWords: string[]) {
  const parts = content.split(/(\s+|[,.!?;:()\[\]"«»\n])/g)

  return parts.map(part => {
    if (!part || /^\s+$/.test(part)) return { type: 'space', value: part }
    if (/^[,.!?;:()\[\]"«»\n]$/.test(part)) return { type: 'punct', value: part }

    const clean = part.replace(/[^a-zA-ZÀ-ÿ'-]/g, '').toLowerCase()
    if (!clean) return { type: 'punct', value: part }

    if (isStopword(clean, lang)) {
      return { type: 'word', value: part, visible: true, isStopword: true }
    }

    const isTitle = titleWords.includes(clean)
    return { type: 'word', value: part, visible: false, isTitle, length: clean.length }
  }).filter(t => t.value !== '')
}