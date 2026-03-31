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
  const hints: ProximityHint[] = []

  for (const token of tokens) {
    if (token.type !== 'word' || token.isStopword) continue

    const score = computeSimilarity(guess, token.value)
    if (score >= PROXIMITY_THRESHOLD && score < 1) {
      hints.push({
        index: token.index,
        score: Math.round(score * 100) / 100,
        length: token.value.length,
      })
    }
  }

  // Retourne les meilleurs hints, triés par score décroissant
  return hints
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PROXIMITY_HINTS)
}
