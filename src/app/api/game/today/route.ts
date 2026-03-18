import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { extractWords, isStopword } from '@/lib/wikipedia'

export async function GET(req: NextRequest) {
  const lang = (req.nextUrl.searchParams.get('lang') || 'fr') as 'fr' | 'en'
  const today = req.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0]

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

  const excludedSections = lang === 'fr'
    ? ['Notes et références', 'Voir aussi', 'Annexes', 'Liens externes', 'Bibliographie', 'Notes', 'Références']
    : ['See also', 'References', 'Further reading', 'External links', 'Notes', 'Bibliography', 'Footnotes']

  const truncatedContent = truncateAtSections(content, excludedSections)

  const titleWords = extractWords(title).map(w => ({
    value: w,
    isStopword: isStopword(w, lang),
    revealed: false,
  }))

  const titleWordsClean = titleWords
    .filter(tw => !tw.isStopword)
    .map(tw => tw.value.toLowerCase())

  const tokens = buildTokens(truncatedContent, lang, titleWordsClean)

  return NextResponse.json({
    id: page.id,
    date: page.date,
    lang,
    tokens,
    titleWords,
    wordCount: lang === 'fr' ? page.word_count_fr : page.word_count_en,
    wikipedia_url_fr: page.wikipedia_url_fr,
    wikipedia_url_en: page.wikipedia_url_en,
  })
}

function truncateAtSections(content: string, excludedSections: string[]): string {
  const lines = content.split('\n')
  const result: string[] = []

  for (const line of lines) {
    const sectionMatch = line.match(/^==+\s*(.+?)\s*==+$/)
    if (sectionMatch) {
      const sectionName = sectionMatch[1].trim()
      if (excludedSections.some(s => sectionName.toLowerCase().includes(s.toLowerCase()))) {
        break
      }
    }
    result.push(line)
  }

  return result.join('\n')
}

function buildTokens(content: string, lang: 'fr' | 'en', titleWords: string[]) {
  const lines = content.split('\n')
  const tokens: any[] = []

  for (const line of lines) {
    const sectionMatch = line.match(/^(==+)\s*(.+?)\s*==+$/)
    if (sectionMatch) {
      const level = sectionMatch[1].length
      const sectionTitle = sectionMatch[2]

      tokens.push({ type: 'space', value: '\n' })

      const parts = sectionTitle.split(/(\s+)/g)
      for (const part of parts) {
        if (!part) continue
        if (/^\s+$/.test(part)) {
          tokens.push({ type: 'space', value: part })
          continue
        }
        const clean = part.replace(/[^a-zA-ZÀ-ÿ'-]/g, '').toLowerCase()
        if (!clean) {
          tokens.push({ type: 'punct', value: part })
          continue
        }
        if (isStopword(clean, lang)) {
          tokens.push({ type: 'word', value: part, visible: true, isStopword: true, isHeading: true, headingLevel: level })
          continue
        }
        const isTitleWord = titleWords.includes(clean)
        tokens.push({
          type: 'word',
          value: part,
          visible: false,
          isTitle: isTitleWord,
          isHeading: true,
          headingLevel: level,
          length: clean.length,
        })
      }

      tokens.push({ type: 'space', value: '\n' })
      continue
    }

    const parts = line.split(/(\s+|[,.!?;:()\[\]"«»])/g)
    for (const part of parts) {
      if (!part) continue
      if (/^\s+$/.test(part)) {
        tokens.push({ type: 'space', value: part })
        continue
      }
      if (/^[,.!?;:()\[\]"«»]$/.test(part)) {
        tokens.push({ type: 'punct', value: part })
        continue
      }
      const clean = part.replace(/[^a-zA-ZÀ-ÿ'-]/g, '').toLowerCase()
      if (!clean) {
        tokens.push({ type: 'punct', value: part })
        continue
      }
      if (isStopword(clean, lang)) {
        tokens.push({ type: 'word', value: part, visible: true, isStopword: true })
        continue
      }
      const isTitleWord = titleWords.includes(clean)
      tokens.push({
        type: 'word',
        value: part,
        visible: false,
        isTitle: isTitleWord,
        length: clean.length,
      })
    }
    tokens.push({ type: 'space', value: '\n' })
  }

  return tokens.filter(t => t.value !== '')
}