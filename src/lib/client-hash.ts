import { normalize } from './matching'
import { createHash } from 'crypto'

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

// Phase 3 Plan 03: server-side pre-compute of the wordHashSet sent to clients for
// instant local verification. Called from /api/survival/start (and later
// consolidates the inline blocks in /api/game/today + /api/ranked/start — out of
// scope here to keep Phase 2.1 regression posture). Kept in client-hash.ts so the
// hash algorithm is co-located with the client-side `sha256Truncated` consumer —
// single source of truth for the SHA-256 truncated-to-16-hex contract.
//
// Byte-identical to the inline block in ranked/start/route.ts:142-152 and
// game/today/route.ts:93-113 (verified 2026-04-18).
export function computeWordHashSet(
  tokens: Array<{ type: string; value: string; isStopword?: boolean }>,
  titleTokens: Array<{ isWord: boolean; isStopword?: boolean; value: string }>
): string[] {
  const wordHashSet: string[] = []
  const seenHashes = new Set<string>()
  for (const token of tokens) {
    if (token.type !== 'word' || token.isStopword) continue
    const norm = normalize(token.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, ''))
    const hash = createHash('sha256').update(norm).digest('hex').slice(0, 16)
    if (!seenHashes.has(hash)) {
      seenHashes.add(hash)
      wordHashSet.push(hash)
    }
  }
  for (const tw of titleTokens) {
    if (!tw.isWord || tw.isStopword) continue
    const norm = normalize(tw.value)
    const hash = createHash('sha256').update(norm).digest('hex').slice(0, 16)
    if (!seenHashes.has(hash)) {
      seenHashes.add(hash)
      wordHashSet.push(hash)
    }
  }
  return wordHashSet
}
