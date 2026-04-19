/**
 * Phase 4 Async Duel — pure comparison + share text helpers.
 * Server-authoritative: callers live in /api/duel/* routes; never imported in client
 * components that render untrusted results (winner determination stays server-side
 * per 04-RESEARCH §Anti-patterns).
 */

export type HalfResult = {
  userId: string
  username: string
  won: boolean
  guessCount: number | null
  durationSec: number | null
  dnf: boolean
}

export type Comparison =
  | { kind: 'tie'; a: HalfResult; b: HalfResult }
  | { kind: 'winner'; winner: HalfResult; loser: HalfResult }
  | { kind: 'unresolved'; a: HalfResult; b: HalfResult }

/**
 * D-17 / D-18 winner rules:
 *   1. both DNF → unresolved
 *   2. exactly one DNF → finisher wins (D-18, outright)
 *   3. both finished, won flag differs → winning side wins
 *   4. same won flag → fewer guesses wins (nulls treated as Infinity)
 *   5. same guessCount → faster duration wins (nulls treated as Infinity)
 *   6. fully equal → tie
 */
export function compareResults(a: HalfResult, b: HalfResult): Comparison {
  if (a.dnf && b.dnf) return { kind: 'unresolved', a, b }
  if (a.dnf && !b.dnf) return { kind: 'winner', winner: b, loser: a }
  if (!a.dnf && b.dnf) return { kind: 'winner', winner: a, loser: b }

  if (a.won && !b.won) return { kind: 'winner', winner: a, loser: b }
  if (!a.won && b.won) return { kind: 'winner', winner: b, loser: a }

  const ag = a.guessCount ?? Infinity
  const bg = b.guessCount ?? Infinity
  if (ag < bg) return { kind: 'winner', winner: a, loser: b }
  if (ag > bg) return { kind: 'winner', winner: b, loser: a }

  const ad = a.durationSec ?? Infinity
  const bd = b.durationSec ?? Infinity
  if (ad < bd) return { kind: 'winner', winner: a, loser: b }
  if (ad > bd) return { kind: 'winner', winner: b, loser: a }

  return { kind: 'tie', a, b }
}

/** D-05: strict inequality so expiresAt === now is NOT expired. */
export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() < now.getTime()
}

type ShareParams = {
  winner: HalfResult | null
  loser: HalfResult | null
  isTie: boolean
  articleTitle: string
  duelUrl: string
  lang: 'fr' | 'en'
}

/**
 * Text fallback for Web Share API when the PNG can't be shared as a file.
 * PNG rendering (SurvivalShareCard-cloned) is the canonical image per D-19.
 */
export function buildDuelShareText(params: ShareParams): string {
  const { winner, loser, isTie, articleTitle, duelUrl, lang } = params
  const nameA = winner?.username ?? 'Player A'
  const nameB = loser?.username ?? (isTie ? 'Player B' : 'Player B')
  const articleLine = lang === 'fr' ? `Article : ${articleTitle}` : `Article: ${articleTitle}`
  const url = `https://wikifinder.vercel.app${duelUrl}`
  return `Wikifinder Duel\n${nameA} vs ${nameB}\n${articleLine}\n${url}`
}
