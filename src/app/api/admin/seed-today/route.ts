import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchRandomQualityArticle, fetchLinkedArticle } from '@/lib/wikipedia'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const today = body.date || new Date().toISOString().split('T')[0]

  // Vérifie qu'il n'y a pas déjà une page aujourd'hui
  const { data: existing } = await supabaseAdmin
    .from('pages')
    .select('id')
    .eq('date', today)
    .single()

  if (existing) {
    return NextResponse.json({ message: 'Une page existe déjà pour aujourd\'hui' })
  }

  // Cherche une paire FR+EN valide (max 20 tentatives)
  let articleFr, articleEn
  let attempts = 0

  while (attempts < 20) {
    attempts++

    try {
      // Cherche un article FR de qualité avec min 1500 mots
      const candidate = await fetchRandomQualityArticle('fr')
      if (candidate.wordCount < 1500) continue

      // Cherche l'article EN lié
      const linked = await fetchLinkedArticle(candidate.title, 'fr')
      if (!linked || linked.wordCount < 1500) continue

      // Paire valide trouvée
      articleFr = candidate
      articleEn = linked
      break
    } catch (e) {
      continue
    }
  }

  if (!articleFr || !articleEn) {
    return NextResponse.json(
      { error: `Impossible de trouver une paire valide après ${attempts} tentatives` },
      { status: 422 }
    )
  }

  // Insère en BDD
  const { data, error } = await supabaseAdmin
    .from('pages')
    .insert({
      date: today,
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