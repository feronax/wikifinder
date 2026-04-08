// Cache en mémoire pour les vérifications Wiktionary
// Évite de refaire la requête pour un mot déjà vérifié
const cache = new Map<string, { exists: boolean; cachedAt: number }>()
const TTL = 1000 * 60 * 60 * 24 // 24h

export async function checkWordExists(word: string, lang: 'fr' | 'en'): Promise<boolean> {
  const key = `${lang}:${word.toLowerCase()}`
  const cached = cache.get(key)

  if (cached && Date.now() - cached.cachedAt < TTL) {
    return cached.exists
  }

  try {
    const url = `https://${lang}.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(word.toLowerCase())}&format=json&origin=*`
    const res = await fetch(url, { headers: { 'User-Agent': 'Wikifinder/1.0' } })
    if (!res.ok) return true // En cas d'erreur, on laisse passer

    const data = await res.json()
    const pages = data.query.pages
    const exists = !('-1' in pages)

    cache.set(key, { exists, cachedAt: Date.now() })

    // Nettoyage périodique
    if (cache.size > 5000) {
      const now = Date.now()
      for (const [k, v] of cache.entries()) {
        if (now - v.cachedAt > TTL) cache.delete(k)
      }
    }

    return exists
  } catch {
    return true
  }
}
