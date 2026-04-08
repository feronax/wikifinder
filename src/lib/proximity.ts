import dice from 'talisman/metrics/dice'
import levenshtein from 'talisman/metrics/levenshtein'
import { normalize } from './matching'

const PROXIMITY_THRESHOLD = 0.55
const MAX_PROXIMITY_HINTS = 8

type ProximityHint = {
  index: number
  score: number
  length: number
}

function computeSimilarity(guess: string, target: string): number {
  const g = normalize(guess)
  const t = normalize(target)

  if (g.length < 3 || t.length < 3) return 0
  if (g === t) return 1

  // Prefix match: "nation" matches "national"
  const shorter = g.length < t.length ? g : t
  const longer = g.length < t.length ? t : g
  if (longer.startsWith(shorter) && shorter.length >= 4) {
    return 0.85
  }

  // Dice coefficient (bigram overlap)
  const diceScore = dice(g, t)

  // Levenshtein normalized
  const maxLen = Math.max(g.length, t.length)
  const levScore = 1 - (levenshtein(g, t) / maxLen)

  return Math.max(diceScore, levScore)
}

export function findProximityHints(
  guess: string,
  tokens: { index: number; value: string; type: string; isStopword: boolean }[]
): ProximityHint[] {
  // Déduplique les mots uniques et calcule la similarité une seule fois par mot
  const uniqueWords = new Map<string, number>() // normalized value -> score
  const tokensByValue = new Map<string, { index: number; length: number }[]>()

  for (const token of tokens) {
    if (token.type !== 'word' || token.isStopword) continue
    const key = normalize(token.value)
    if (!tokensByValue.has(key)) {
      tokensByValue.set(key, [])
    }
    tokensByValue.get(key)!.push({ index: token.index, length: token.value.length })

    if (!uniqueWords.has(key)) {
      uniqueWords.set(key, computeSimilarity(guess, token.value))
    }
  }

  // Collecte les hints (en gardant seulement les meilleurs mots uniques)
  const wordScores: { key: string; score: number }[] = []
  for (const [key, score] of uniqueWords.entries()) {
    if (score >= PROXIMITY_THRESHOLD && score < 1) {
      wordScores.push({ key, score })
    }
  }

  // Trie par score et prend les top N mots uniques
  wordScores.sort((a, b) => b.score - a.score)
  const topWords = wordScores.slice(0, MAX_PROXIMITY_HINTS)

  // Pour chaque mot unique top, applique à tous ses tokens
  const hints: ProximityHint[] = []
  for (const { key, score } of topWords) {
    const occurrences = tokensByValue.get(key) || []
    for (const occ of occurrences) {
      hints.push({
        index: occ.index,
        score: Math.round(score * 100) / 100,
        length: occ.length,
      })
    }
  }

  return hints
}
