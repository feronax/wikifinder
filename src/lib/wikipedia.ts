const STOPWORDS_FR = new Set([
  'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en',
  'au', 'aux', 'ce', 'se', 'sa', 'son', 'ses', 'mon', 'ma', 'mes',
  'ton', 'ta', 'tes', 'il', 'elle', 'ils', 'elles', 'nous', 'vous',
  'je', 'tu', 'on', 'que', 'qui', 'quoi', 'dont', 'où', 'par',
  'sur', 'sous', 'dans', 'avec', 'pour', 'pas', 'plus', 'ou', 'si',
  'ne', 'y', 'à', 'est', 'sont', 'était', 'être', 'a', 'ont', 'eu'
])

const STOPWORDS_EN = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
  'for', 'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were',
  'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'it', 'its', 'this',
  'that', 'these', 'those', 'he', 'she', 'they', 'we', 'you', 'i'
])

export function isStopword(word: string, lang: 'fr' | 'en'): boolean {
  const stopwords = lang === 'fr' ? STOPWORDS_FR : STOPWORDS_EN
  return stopwords.has(word.toLowerCase())
}

export function extractWords(text: string): string[] {
  return text
    .replace(/[^a-zA-ZÀ-ÿ\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0)
}

// Récupère un article Wikipedia de qualité aléatoire
export async function fetchRandomQualityArticle(lang: 'fr' | 'en') {
  // 1. Récupère une liste d'articles de qualité
  const categoryUrl = lang === 'fr'
    ? 'https://fr.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Cat%C3%A9gorie:Article_de_qualit%C3%A9&cmlimit=500&format=json&origin=*'
    : 'https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Featured_articles&cmlimit=500&format=json&origin=*'

  const catRes = await fetch(categoryUrl)
  const catData = await catRes.json()
  const members = catData.query.categorymembers

  // 2. Choisit un article aléatoire dans la liste
  const random = members[Math.floor(Math.random() * members.length)]

  // 3. Récupère le contenu de l'article
  const contentUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(random.title)}&prop=extracts&explaintext=true&format=json&origin=*`
  const contentRes = await fetch(contentUrl)
  const contentData = await contentRes.json()
  const pages = contentData.query.pages
  const page = Object.values(pages)[0] as any

  const words = extractWords(page.extract || '')

  return {
    title: page.title,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
    content: page.extract || '',
    wordCount: words.length
  }
}

// Trouve l'article lié dans l'autre langue
export async function fetchLinkedArticle(title: string, fromLang: 'fr' | 'en') {
  const toLang = fromLang === 'fr' ? 'en' : 'fr'
  const url = `https://${fromLang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=langlinks&lllang=${toLang}&format=json&origin=*`

  const res = await fetch(url)
  const data = await res.json()
  const pages = data.query.pages
  const page = Object.values(pages)[0] as any
  const langlinks = page.langlinks

  if (!langlinks || langlinks.length === 0) return null

  const linkedTitle = langlinks[0]['*']
  const contentUrl = `https://${toLang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(linkedTitle)}&prop=extracts&explaintext=true&format=json&origin=*`
  const contentRes = await fetch(contentUrl)
  const contentData = await contentRes.json()
  const linkedPages = contentData.query.pages
  const linkedPage = Object.values(linkedPages)[0] as any

  const words = extractWords(linkedPage.extract || '')

  return {
    title: linkedPage.title,
    url: `https://${toLang}.wikipedia.org/wiki/${encodeURIComponent(linkedPage.title)}`,
    content: linkedPage.extract || '',
    wordCount: words.length
  }
}