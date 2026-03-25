// Fichier serveur uniquement — ne pas importer côté client

export interface ArticleResult {
  title: string
  url: string
  content: string
  wordCount: number
  pageviews: number
  usedFallback: boolean
}

function extractWords(text: string): string[] {
  return text
    .replace(/[^a-zA-ZÀ-ÿ0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0)
}

async function getMonthlyPageviews(title: string, lang: 'fr' | 'en'): Promise<number> {
  try {
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const year = lastMonth.getFullYear()
    const month = String(lastMonth.getMonth() + 1).padStart(2, '0')
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/all-agents/${encodeURIComponent(title)}/monthly/${year}${month}01/${year}${month}28`
    const res = await fetch(url)
    if (!res.ok) return 0
    const data = await res.json()
    const items: any[] = data.items || []
    return items.reduce((sum: number, item: any) => sum + (item.views || 0), 0)
  } catch {
    return 0
  }
}

async function fetchQualityArticleList(lang: 'fr' | 'en', limit = 500): Promise<{ title: string, pageid: number }[]> {
  const categoryTitle = lang === 'fr'
    ? 'Cat%C3%A9gorie:Article_de_qualit%C3%A9'
    : 'Category:Featured_articles'

  const allMembers: { title: string, pageid: number }[] = []
  let cmcontinue: string | undefined

  for (let page = 0; page < 4; page++) {
    const continueParam = cmcontinue ? `&cmcontinue=${encodeURIComponent(cmcontinue)}` : ''
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${categoryTitle}&cmlimit=${limit}&format=json&origin=*${continueParam}`
    const res = await fetch(url)
    const data = await res.json()
    allMembers.push(...(data.query?.categorymembers || []))
    if (!data.continue?.cmcontinue) break
    cmcontinue = data.continue.cmcontinue as string
  }

  return allMembers
}

async function fetchArticleContent(title: string, lang: 'fr' | 'en') {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=true&format=json&origin=*`
  const res = await fetch(url)
  const data = await res.json()
  const pages = data.query.pages
  return Object.values(pages)[0] as any
}

async function tryFindArticle(
  candidates: { title: string, pageid: number }[],
  lang: 'fr' | 'en',
  minViews: number,
  maxViews: number,
  minWords: number,
  maxAttempts = 20
): Promise<Omit<ArticleResult, 'usedFallback'> | null> {
  let attempts = 0

  for (const candidate of candidates) {
    if (attempts >= maxAttempts) break
    attempts++

    try {
      const views = await getMonthlyPageviews(candidate.title, lang)
      if (views < minViews || views > maxViews) continue

      const page = await fetchArticleContent(candidate.title, lang)
      if (!page?.extract) continue

      const words = extractWords(page.extract)
      if (words.length < minWords) continue

      return {
        title: page.title,
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        content: page.extract,
        wordCount: words.length,
        pageviews: views,
      }
    } catch {
      continue
    }
  }

  return null
}

export async function fetchRandomQualityArticle(
  lang: 'fr' | 'en',
  alreadyUsedTitles: string[] = []
): Promise<ArticleResult> {
  const MIN_VIEWS = 20_000
  const MAX_VIEWS = 1_000_000
  const MIN_WORD_COUNT = 1500

  const allMembers = await fetchQualityArticleList(lang)
  const shuffled = allMembers.sort(() => Math.random() - 0.5)
  const usedSet = new Set(alreadyUsedTitles.map(t => t.toLowerCase()))
  const candidates = shuffled.filter(m => !usedSet.has(m.title.toLowerCase()))

  if (candidates.length === 0) {
    throw new Error('Tous les articles de qualité ont déjà été utilisés.')
  }

  const result = await tryFindArticle(candidates, lang, MIN_VIEWS, MAX_VIEWS, MIN_WORD_COUNT)
  if (result) return { ...result, usedFallback: false }

  console.log(`[wikipedia] Tranche principale épuisée, fallback > ${MAX_VIEWS} vues`)
  const fallback = await tryFindArticle(candidates, lang, MAX_VIEWS, Infinity, MIN_WORD_COUNT)
  if (fallback) return { ...fallback, usedFallback: true }

  console.log('[wikipedia] Fallback épuisé, sélection sans filtre')
  const anyArticle = await tryFindArticle(candidates, lang, 0, Infinity, MIN_WORD_COUNT)
  if (anyArticle) return { ...anyArticle, usedFallback: true }

  throw new Error('Impossible de trouver un article éligible.')
}