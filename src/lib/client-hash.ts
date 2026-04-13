import { normalize } from './matching'

let hashSetCache: Set<string> | null = null

export function setWordHashSet(hashes: string[]) {
  hashSetCache = new Set(hashes)
}

export async function isWordInArticle(word: string): Promise<boolean> {
  if (!hashSetCache) return false
  const norm = normalize(word)
  const hash = await sha256Truncated(norm)
  return hashSetCache.has(hash)
}

async function sha256Truncated(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}
