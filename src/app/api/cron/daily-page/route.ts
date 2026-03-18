import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchRandomQualityArticle, fetchLinkedArticle } from '@/lib/wikipedia'

export async function GET(req: NextRequest) {
  // Sécurité : vérifie le token Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Génère la page pour demain
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const date = tomorrow.toISOString().split('T')[0]

  // Vérifie qu'il n'y a pas déjà une page pour demain
  const { data: existing } = await supabaseAdmin
    .from('pages')
    .select('id')
    .eq('date', date)
    .single()

  if (existing) {
    return NextResponse.json({ message: 'Page déjà générée pour demain' })
  }

  // Cherche une paire FR+EN valide (max 20 tentatives)
  let articleFr, articleEn
  let attempts = 0

  while (attempts < 20) {
    attempts++
    try {
      const candidate = await fetchRandomQualityArticle('fr')
      if (candidate.wordCount < 1500) continue

      const linked = await fetchLinkedArticle(candidate.title, 'fr')
      if (!linked || linked.wordCount < 1500) continue

      // Vérifie que cet article n'a jamais été joué
      const { data: alreadyPlayed } = await supabaseAdmin
        .from('pages')
        .select('id')
        .eq('wikipedia_title_fr', candidate.title)
        .single()

      if (alreadyPlayed) continue

      articleFr = candidate
      articleEn = linked
      break
    } catch {
      continue
    }
  }

  if (!articleFr || !articleEn) {
    return NextResponse.json(
      { error: `Impossible de trouver une paire valide après ${attempts} tentatives` },
      { status: 422 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('pages')
    .insert({
      date,
      wikipedia_title_fr: articleFr.title,
      wikipedia_title_en: articleEn.title,
      wikipedia_url_fr: articleFr.url,
      wikipedia_url_en: articleEn.url,
      word_count_fr: articleFr.wordCount,
      word_count_en: articleEn.wordCount,
      content_fr: articleFr.content,
      content_en: articleEn.content,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, page: data })
}