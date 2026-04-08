import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchRandomQualityArticle } from '@/lib/wikipedia-seed'
import { fetchLinkedArticle } from '@/lib/wikipedia'
import { tokenizeContent, tokenizeTitle } from '@/lib/tokenize'

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const date = tomorrow.toISOString().split('T')[0]

    const { data: existing } = await supabaseAdmin
        .from('pages')
        .select('id')
        .eq('date', date)
        .single()

    if (existing) {
        return NextResponse.json({ message: 'Page déjà générée pour demain' })
    }

    const { data: usedPages } = await supabaseAdmin
        .from('pages')
        .select('wikipedia_title_fr')

    const alreadyUsedTitles = (usedPages || [])
        .map((p: { wikipedia_title_fr?: string }) => p.wikipedia_title_fr)
        .filter((title): title is string => Boolean(title))

    const MAX_RETRIES = 5

    try {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const articleFr = await fetchRandomQualityArticle('fr', alreadyUsedTitles)
            const articleEn = await fetchLinkedArticle(articleFr.title, 'fr')

            if (!articleEn || articleEn.wordCount < 800) {
                alreadyUsedTitles.push(articleFr.title)
                continue
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
                    tokens_fr: tokenizeContent(articleFr.content, 'fr'),
                    tokens_en: tokenizeContent(articleEn.content, 'en'),
                    title_tokens_fr: tokenizeTitle(articleFr.title, 'fr'),
                    title_tokens_en: tokenizeTitle(articleEn.title, 'en'),
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
                attempts: attempt + 1,
            })
        }

        return NextResponse.json(
            { error: `Aucun article valide trouvé après ${MAX_RETRIES} tentatives` },
            { status: 422 }
        )
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Une erreur inconnue est survenue'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}