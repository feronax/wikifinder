// Cache Wiktionary deux niveaux : L1 Map in-memory + L2 Upstash Redis (survit aux cold starts)
// Fall-through SACRED (D-15) : toute erreur Upstash ou fetch => on laisse passer la supposition
import { safeGet, safeSet } from './redis'

const cache = new Map<string, { exists: boolean; cachedAt: number }>()
const TTL = 1000 * 60 * 60 * 24 // 24h (L1)
const TTL_SEC = 60 * 60 * 24 // 24h (L2 Upstash, en secondes)

export async function checkWordExists(word: string, lang: 'fr' | 'en'): Promise<boolean> {
  const normalized = word.toLowerCase()
  const key = `${lang}:${normalized}`
  const cached = cache.get(key)

  if (cached && Date.now() - cached.cachedAt < TTL) {
    return cached.exists
  }

  const l2Key = `wf:wkt:v1:${lang}:${normalized}`
  const l2 = await safeGet(l2Key)
  if (l2 === '1' || l2 === '0') {
    const exists = l2 === '1'
    cache.set(key, { exists, cachedAt: Date.now() })
    return exists
  }

  try {
    const url = `https://${lang}.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(normalized)}&format=json&origin=*`
    const res = await fetch(url, { headers: { 'User-Agent': 'Wikifinder/1.0' } })
    if (!res.ok) return true // En cas d'erreur, on laisse passer

    const data = await res.json()
    const pages = data.query.pages
    const exists = !('-1' in pages)

    cache.set(key, { exists, cachedAt: Date.now() })
    void safeSet(l2Key, exists ? '1' : '0', TTL_SEC)

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
