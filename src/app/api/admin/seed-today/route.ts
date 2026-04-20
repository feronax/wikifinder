import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchRandomQualityArticle } from '@/lib/wikipedia-seed'
import { fetchLinkedArticle } from '@/lib/wikipedia'
import { tokenizeContent, tokenizeTitle } from '@/lib/tokenize'
import { parseJsonBody, DateSchema } from '@/lib/validation'
import { requireAdmin } from '@/lib/admin-auth'

const SeedTodayBodySchema = z.object({
  date: DateSchema.optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const parsed = await parseJsonBody(req, SeedTodayBodySchema)
  if ('error' in parsed) return parsed.error
  const targetDate = parsed.data.date || new Date().toISOString().split('T')[0]

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

    const enContent = enArticle?.content || ''
    const enTitle = enArticle?.title || frArticle.title

    const { error } = await supabaseAdmin.from('pages').insert({
      date: targetDate,
      wikipedia_title_fr: frArticle.title,
      wikipedia_title_en: enTitle,
      wikipedia_url_fr: frArticle.url,
      wikipedia_url_en: enArticle?.url || frArticle.url,
      content_fr: frArticle.content,
      content_en: enContent,
      word_count_fr: frArticle.wordCount,
      word_count_en: enArticle?.wordCount || 0,
      tokens_fr: tokenizeContent(frArticle.content, 'fr'),
      tokens_en: tokenizeContent(enContent, 'en'),
      title_tokens_fr: tokenizeTitle(frArticle.title, 'fr'),
      title_tokens_en: tokenizeTitle(enTitle, 'en'),
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
    Sentry.captureException(err, {
      tags: { context: 'admin/seed-today' },
    })
    const errorMessage = err instanceof Error ? err.message : 'Une erreur inconnue est survenue'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}