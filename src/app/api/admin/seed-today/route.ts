import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchRandomQualityArticle } from '@/lib/wikipedia-seed'
import { fetchLinkedArticle } from '@/lib/wikipedia'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const targetDate: string = body.date || new Date().toISOString().split('T')[0]

  const { data: existing } = await supabaseAdmin
    .from('pages')
    .select('id')
    .eq('date', targetDate)
    .single()

  if (existing) {
    return NextResponse.json({ error: `Une page existe déjà pour le ${targetDate}` }, { status: 409 })
  }

  const { data: usedPages } = await supabaseAdmin
    .from('pages')
    .select('wikipedia_title_fr')

  const alreadyUsedTitles = (usedPages || [])
    .map((p: { wikipedia_title_fr?: string }) => p.wikipedia_title_fr)
    .filter((title): title is string => Boolean(title))

  try {
    const frArticle = await fetchRandomQualityArticle('fr', alreadyUsedTitles)
    const enArticle = await fetchLinkedArticle(frArticle.title, 'fr')

    const { error } = await supabaseAdmin.from('pages').insert({
      date: targetDate,
      wikipedia_title_fr: frArticle.title,
      wikipedia_title_en: enArticle?.title || frArticle.title,
      wikipedia_url_fr: frArticle.url,
      wikipedia_url_en: enArticle?.url || frArticle.url,
      content_fr: frArticle.content,
      content_en: enArticle?.content || '',
      word_count_fr: frArticle.wordCount,
      word_count_en: enArticle?.wordCount || 0,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      date: targetDate,
      title_fr: frArticle.title,
      title_en: enArticle?.title,
      pageviews: frArticle.pageviews,
      usedFallback: frArticle.usedFallback,
      word_count_fr: frArticle.wordCount,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Une erreur inconnue est survenue'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}