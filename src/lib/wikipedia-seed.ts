import { extractWords } from '@/lib/wikipedia'

const MIN_WORD_COUNT = 2000
const MIN_PAGEVIEWS = 1000
const MAX_ATTEMPTS = 25
const WIKI_HEADERS = { 'User-Agent': 'Wikifinder/1.0 (https://wikifinder.vercel.app)' }

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
        const res = await fetch(url, { headers: WIKI_HEADERS })
        if (!res.ok) return 0
        const data = await res.json()
        return (data.items || []).reduce((sum: number, item: any) => sum + (item.views || 0), 0)
    } catch {
        return 0
    }
}

async function fetchArticleContent(title: string, lang: 'fr' | 'en') {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts|info&explaintext=true&inprop=url&format=json&origin=*`
    const res = await fetch(url, { headers: WIKI_HEADERS })
    if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`)
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { throw new Error(`Wikipedia returned invalid JSON for "${title}": ${text.slice(0, 200)}`) }
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
        try {
            const randomUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*`
            console.log(`[seed] attempt ${attempt + 1}: fetching random article...`)
            const randomRes = await fetch(randomUrl, { headers: WIKI_HEADERS })
            if (!randomRes.ok) { console.log(`[seed] random API returned ${randomRes.status}`); continue }
            const randomText = await randomRes.text()
            let randomData
            try { randomData = JSON.parse(randomText) } catch { console.log(`[seed] random API returned non-JSON:`, randomText.slice(0, 100)); continue }
            const title = randomData.query.random[0].title
            console.log(`[seed] got title: "${title}"`)

            if (alreadyUsedTitles.includes(title)) { console.log(`[seed] already used, skip`); continue }

            const { title: cleanTitle, url, content } = await fetchArticleContent(title, lang)
            const wordCount = extractWords(content).length
            console.log(`[seed] "${cleanTitle}" has ${wordCount} words (min: ${MIN_WORD_COUNT})`)
            if (wordCount < MIN_WORD_COUNT) continue

            const pageviews = await getPageviews(cleanTitle, lang)
            console.log(`[seed] "${cleanTitle}" has ${pageviews} pageviews (min: ${MIN_PAGEVIEWS})`)
            if (pageviews < MIN_PAGEVIEWS) continue

            return { title: cleanTitle, url, content, wordCount, pageviews, usedFallback: false }
        } catch { continue }
    }

    // Fallback : article sans filtre pageviews, juste longueur suffisante
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
            const randomUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*`
            const randomRes = await fetch(randomUrl, { headers: WIKI_HEADERS })
            if (!randomRes.ok) continue
            const randomText = await randomRes.text()
            let randomData
            try { randomData = JSON.parse(randomText) } catch { continue }
            const title = randomData.query.random[0].title

            if (alreadyUsedTitles.includes(title)) continue

            const { title: cleanTitle, url, content } = await fetchArticleContent(title, lang)
            const wordCount = extractWords(content).length
            if (wordCount < MIN_WORD_COUNT) continue

            const pageviews = await getPageviews(cleanTitle, lang)
            return { title: cleanTitle, url, content, wordCount, pageviews, usedFallback: true }
        } catch { continue }
    }

    // Ultime fallback : accepte des articles plus courts (800 mots min)
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
            const randomUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*`
            const randomRes = await fetch(randomUrl, { headers: WIKI_HEADERS })
            if (!randomRes.ok) continue
            const randomText = await randomRes.text()
            let randomData
            try { randomData = JSON.parse(randomText) } catch { continue }
            const title = randomData.query.random[0].title

            if (alreadyUsedTitles.includes(title)) continue

            const { title: cleanTitle, url, content } = await fetchArticleContent(title, lang)
            const wordCount = extractWords(content).length
            if (wordCount < 800) continue

            const pageviews = await getPageviews(cleanTitle, lang)
            return { title: cleanTitle, url, content, wordCount, pageviews, usedFallback: true }
        } catch { continue }
    }

    throw new Error(`Impossible de trouver un article ${lang} valide après ${MAX_ATTEMPTS * 3} tentatives`)
}