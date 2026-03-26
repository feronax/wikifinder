import { extractWords } from '@/lib/wikipedia'

const MIN_WORD_COUNT = 2000
const MIN_PAGEVIEWS = 1000
const MAX_ATTEMPTS = 10

type ArticleResult = {
    title: string
    url: string
    content: string
    wordCount: number
    pageviews: number
    usedFallback: boolean
}

async function getPageviews(title: string, lang: 'fr' | 'en'): Promise<number> {
    try {
        const end = new Date()
        const start = new Date()
        start.setDate(end.getDate() - 30)
        const fmt = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '')
        const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/all-agents/${encodeURIComponent(title)}/monthly/${fmt(start)}/${fmt(end)}`
        const res = await fetch(url)
        if (!res.ok) return 0
        const data = await res.json()
        return (data.items || []).reduce((sum: number, item: any) => sum + (item.views || 0), 0)
    } catch {
        return 0
    }
}

async function fetchArticleContent(title: string, lang: 'fr' | 'en') {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts|info&explaintext=true&inprop=url&format=json&origin=*`
    const res = await fetch(url)
    const data = await res.json()
    const page = Object.values(data.query.pages)[0] as any
    return {
        title: page.title as string,
        url: page.fullurl as string,
        content: (page.extract || '') as string,
    }
}

export async function fetchRandomQualityArticle(
    lang: 'fr' | 'en',
    alreadyUsedTitles: string[] = []
): Promise<ArticleResult> {
    // Tentatives avec filtre qualité
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const randomUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*`
        const randomRes = await fetch(randomUrl)
        const randomData = await randomRes.json()
        const title = randomData.query.random[0].title

        if (alreadyUsedTitles.includes(title)) continue

        const { title: cleanTitle, url, content } = await fetchArticleContent(title, lang)
        const wordCount = extractWords(content).length
        if (wordCount < MIN_WORD_COUNT) continue

        const pageviews = await getPageviews(cleanTitle, lang)
        if (pageviews < MIN_PAGEVIEWS) continue

        return { title: cleanTitle, url, content, wordCount, pageviews, usedFallback: false }
    }

    // Fallback : article sans filtre pageviews, juste longueur suffisante
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const randomUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*`
        const randomRes = await fetch(randomUrl)
        const randomData = await randomRes.json()
        const title = randomData.query.random[0].title

        if (alreadyUsedTitles.includes(title)) continue

        const { title: cleanTitle, url, content } = await fetchArticleContent(title, lang)
        const wordCount = extractWords(content).length
        if (wordCount < MIN_WORD_COUNT) continue

        const pageviews = await getPageviews(cleanTitle, lang)
        return { title: cleanTitle, url, content, wordCount, pageviews, usedFallback: true }
    }

    throw new Error(`Impossible de trouver un article ${lang} valide après ${MAX_ATTEMPTS * 2} tentatives`)
}