import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isStopword } from '@/lib/wikipedia'

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

  const titleWords = extractTitleParts(title, lang)
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

function extractTitleParts(title: string, lang: 'fr' | 'en') {
  const result: { value: string, isStopword: boolean, revealed: boolean, length: number }[] = []

  const rawParts = title.split(/[\s()\[\],.!?;:"«»]+/).filter(p => p.length > 0)

  for (const part of rawParts) {
    const hyphenParts = part.split('-').filter(p => p.length > 0)
    for (const hp of hyphenParts) {
      const clean = hp.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '')
      if (!clean) continue

      // Purement numérique → masqué, devinable
      if (/^\d+$/.test(clean)) {
        result.push({ value: clean, isStopword: false, revealed: false, length: clean.length })
        continue
      }

      // Mixte chiffres+lettres → split
      if (/\d/.test(clean) && /[a-zA-ZÀ-ÿ]/.test(clean)) {
        const mixedParts = clean.split(/(\d+)/g).filter(p => p.length > 0)
        for (const mp of mixedParts) {
          if (/^\d+$/.test(mp)) {
            result.push({ value: mp, isStopword: false, revealed: false, length: mp.length })
          } else {
            result.push({ value: mp, isStopword: isStopword(mp.toLowerCase(), lang), revealed: false, length: mp.length })
          }
        }
        continue
      }

      result.push({ value: clean, isStopword: isStopword(clean.toLowerCase(), lang), revealed: false, length: clean.length })
    }
  }

  return result
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

function tokenizeFragment(fragment: string, lang: 'fr' | 'en', titleWords: string[], opts: { isHeading?: boolean, headingLevel?: number } = {}): any[] {
  const result: any[] = []
  const hyphenParts = fragment.split(/(-)/g)

  for (const part of hyphenParts) {
    if (!part) continue
    if (part === '-') {
      result.push({ type: 'punct', value: '-' })
      continue
    }

    const subParts = part.split(/([,.!?;:()\[\]"«»]+)/g)
    for (const sub of subParts) {
      if (!sub) continue
      if (/^[,.!?;:()\[\]"«»]+$/.test(sub)) {
        result.push({ type: 'punct', value: sub })
        continue
      }

      const clean = sub.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '').toLowerCase()
      if (!clean) {
        result.push({ type: 'punct', value: sub })
        continue
      }

      // Purement numérique → masqué, devinable
      if (/^\d+$/.test(clean)) {
        const isTitleWord = titleWords.includes(clean)
        result.push({ type: 'word', value: sub, visible: false, isTitle: isTitleWord, length: clean.length, ...(opts.isHeading ? { isHeading: true, headingLevel: opts.headingLevel } : {}) })
        continue
      }

      // Mixte chiffres+lettres → split
      if (/\d/.test(clean) && /[a-zA-ZÀ-ÿ]/.test(clean)) {
        const mixedParts = sub.split(/(\d+)/g)
        for (const mp of mixedParts) {
          if (!mp) continue
          const mpClean = mp.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '').toLowerCase()
          if (!mpClean) continue
          if (/^\d+$/.test(mpClean)) {
            const isTitleWord = titleWords.includes(mpClean)
            result.push({ type: 'word', value: mp, visible: false, isTitle: isTitleWord, length: mpClean.length, ...(opts.isHeading ? { isHeading: true, headingLevel: opts.headingLevel } : {}) })
          } else {
            if (isStopword(mpClean, lang)) {
              result.push({ type: 'word', value: mp, visible: true, isStopword: true, ...(opts.isHeading ? { isHeading: true, headingLevel: opts.headingLevel } : {}) })
            } else {
              result.push({ type: 'word', value: mp, visible: false, isTitle: titleWords.includes(mpClean), length: mpClean.length, ...(opts.isHeading ? { isHeading: true, headingLevel: opts.headingLevel } : {}) })
            }
          }
        }
        continue
      }

      if (isStopword(clean, lang)) {
        result.push({ type: 'word', value: sub, visible: true, isStopword: true, ...(opts.isHeading ? { isHeading: true, headingLevel: opts.headingLevel } : {}) })
        continue
      }

      const isTitleWord = titleWords.includes(clean)
      result.push({
        type: 'word', value: sub, visible: false, isTitle: isTitleWord, length: clean.length,
        ...(opts.isHeading ? { isHeading: true, headingLevel: opts.headingLevel } : {}),
      })
    }
  }

  return result
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
        if (/^\s+$/.test(part)) { tokens.push({ type: 'space', value: part }); continue }
        tokens.push(...tokenizeFragment(part, lang, titleWords, { isHeading: true, headingLevel: level }))
      }
      tokens.push({ type: 'space', value: '\n' })
      continue
    }

    const parts = line.split(/(\s+)/g)
    for (const part of parts) {
      if (!part) continue
      if (/^\s+$/.test(part)) { tokens.push({ type: 'space', value: part }); continue }
      tokens.push(...tokenizeFragment(part, lang, titleWords))
    }
    tokens.push({ type: 'space', value: '\n' })
  }

  return tokens.filter(t => t.value !== '')
}