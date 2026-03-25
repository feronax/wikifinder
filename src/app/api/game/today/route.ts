import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isStopword } from '@/lib/wikipedia'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lang = searchParams.get('lang') as 'fr' | 'en' || 'fr'
  let targetDate = searchParams.get('date')

  if (!targetDate) {
    targetDate = new Date().toISOString().split('T')[0]
  }

  // 1. Récupération de l'article depuis la base de données
  const { data: page, error } = await supabaseAdmin
    .from('pages')
    .select('*')
    .eq('date', targetDate)
    .single()

  if (error || !page) {
    return NextResponse.json({ error: 'Page non trouvée' }, { status: 404 })
  }

  const title = lang === 'fr' ? page.wikipedia_title_fr : page.wikipedia_title_en
  const content = lang === 'fr' ? page.content_fr : page.content_en

  // 2. Tokenization du titre
  const titleWords = title.split(/(\s+|[-',.()])/).filter(Boolean).map((t: string) => {
    const isWord = /[a-zA-ZÀ-ÿ0-9]/.test(t)
    const isStop = isWord ? isStopword(t, lang) : true
    return {
      value: t,
      isStopword: isStop,
      revealed: !isWord || isStop,
      length: isWord ? t.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '').length : 0
    }
  })

  // 3. Tokenization du contenu de l'article
  const lines = content.split('\n')
  const tokens: any[] = []

  for (const line of lines) {
    // Gestion basique des titres (si Wikipedia renvoie des == Titre ==)
    const headingMatch = line.match(/^(={2,6})\s*(.+?)\s*\1$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2]
      
      const lineTokens = text.split(/([ \t]+|[-',.()«»"!?;:])/).filter(Boolean)
      for (const t of lineTokens) {
        if (/^[ \t]+$/.test(t)) {
          tokens.push({ type: 'space', value: t })
        } else if (/^[a-zA-ZÀ-ÿ0-9]+$/.test(t)) {
          tokens.push({
            type: 'word',
            value: t,
            visible: false,
            isStopword: isStopword(t, lang),
            isHeading: true,
            headingLevel: level,
            length: t.length
          })
        } else {
          tokens.push({ type: 'punct', value: t })
        }
      }
      tokens.push({ type: 'space', value: '\n' })
      continue
    }

    // Gestion du texte normal
    const lineTokens = line.split(/([ \t]+|[-',.()«»"!?;:])/).filter(Boolean)
    for (const t of lineTokens) {
      if (/^[ \t]+$/.test(t)) {
        tokens.push({ type: 'space', value: t })
      } else if (/[a-zA-ZÀ-ÿ0-9]/.test(t)) {
        tokens.push({
          type: 'word',
          value: t,
          visible: false,
          isStopword: isStopword(t, lang),
          length: t.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '').length
        })
      } else {
        tokens.push({ type: 'punct', value: t })
      }
    }
    tokens.push({ type: 'space', value: '\n' })
  }

  // 4. Renvoi des données au format attendu par le jeu
  return NextResponse.json({
    id: page.id,
    date: page.date,
    titleWords,
    tokens,
    wikipedia_url_fr: page.wikipedia_url_fr,
    wikipedia_url_en: page.wikipedia_url_en
  })
}