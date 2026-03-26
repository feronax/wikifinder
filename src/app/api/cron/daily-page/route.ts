import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchRandomQualityArticle } from '@/lib/wikipedia-seed'
import { fetchLinkedArticle } from '@/lib/wikipedia'

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

  // Récupère tous les titres déjà utilisés
  const { data: usedPages } = await supabaseAdmin
    .from('pages')
    .select('wikipedia_title_fr')

  const alreadyUsedTitles = (usedPages || [])
    .map((p: any) => p.wikipedia_title_fr)
    .filter(Boolean)

  try {
    // fetchRandomQualityArticle gère déjà le filtre pageviews,
    // les articles déjà utilisés, et le fallback automatiquement
    const articleFr = await fetchRandomQualityArticle('fr', alreadyUsedTitles)

    const articleEn = await fetchLinkedArticle(articleFr.title, 'fr')

    if (!articleEn || articleEn.wordCount < 1500) {
      return NextResponse.json(
        { error: 'Article EN lié introuvable ou trop court' },
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

    return NextResponse.json({
      success: true,
      page: data,
      pageviews: articleFr.pageviews,
      usedFallback: articleFr.usedFallback,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}