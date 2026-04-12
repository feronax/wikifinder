import { supabaseAdmin } from './supabase-admin'
import { extractWords } from './wikipedia'
import { tokenizeContent, tokenizeTitle } from './tokenize'

const WIKI_HEADERS = { 'User-Agent': 'Wikifinder/1.0 (https://wikifinder.vercel.app)' }

// Seuils de pageviews par difficulté
const DIFFICULTY_THRESHOLDS: Record<string, { min: number; max: number; minWords: number }> = {
  bronze:   { min: 500000, max: Infinity, minWords: 1500 },
  silver:   { min: 100000, max: 500000, minWords: 1500 },
  gold:     { min: 50000, max: 100000, minWords: 1200 },
  platinum: { min: 20000, max: 50000, minWords: 1000 },
  diamond:  { min: 5000, max: 20000, minWords: 800 },
}

async function getPageviews(title: string, lang: string): Promise<number> {
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

/**
 * Seed un article classé pour une langue et difficulté donnée
 */
export async function seedRankedArticle(
  lang: 'fr' | 'en',
  difficulty: string
): Promise<{ title: string; pageviews: number } | null> {
  const thresholds = DIFFICULTY_THRESHOLDS[difficulty]
  if (!thresholds) return null

  // Récupère les articles déjà utilisés
  const { data: existing } = await supabaseAdmin
    .from('ranked_pages')
    .select('wikipedia_title')
    .eq('lang', lang)

  const usedTitles = new Set((existing || []).map((p: any) => p.wikipedia_title))

  // Aussi exclure les articles du mode quotidien
  const { data: dailyPages } = await supabaseAdmin
    .from('pages')
    .select(lang === 'fr' ? 'wikipedia_title_fr' : 'wikipedia_title_en')

  const dailyTitles = new Set(
    (dailyPages || []).map((p: any) => lang === 'fr' ? p.wikipedia_title_fr : p.wikipedia_title_en).filter(Boolean)
  )

  const MAX_ATTEMPTS = 30

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const randomUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*`
      const randomRes = await fetch(randomUrl, { headers: WIKI_HEADERS })
      if (!randomRes.ok) continue
      const randomText = await randomRes.text()
      let randomData
      try { randomData = JSON.parse(randomText) } catch { continue }
      const title = randomData.query.random[0].title

      if (usedTitles.has(title) || dailyTitles.has(title)) continue

      // Fetch article content
      const contentUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts|info&explaintext=true&inprop=url&format=json&origin=*`
      const contentRes = await fetch(contentUrl, { headers: WIKI_HEADERS })
      if (!contentRes.ok) continue
      let contentData
      try { contentData = await contentRes.json() } catch { continue }
      const page = Object.values(contentData.query.pages)[0] as any
      const content = page.extract || ''
      const wordCount = extractWords(content).length

      if (wordCount < thresholds.minWords) continue

      // Check pageviews
      const pageviews = await getPageviews(page.title, lang)
      if (pageviews < thresholds.min || pageviews >= thresholds.max) continue

      // Insert
      const tokens = tokenizeContent(content, lang)
      const titleTokens = tokenizeTitle(page.title, lang)

      const { error } = await supabaseAdmin.from('ranked_pages').insert({
        lang,
        difficulty,
        wikipedia_title: page.title,
        wikipedia_url: page.fullurl,
        content,
        word_count: wordCount,
        pageviews,
        tokens,
        title_tokens: titleTokens,
      })

      if (error) continue

      return { title: page.title, pageviews }
    } catch { continue }
  }

  return null
}
