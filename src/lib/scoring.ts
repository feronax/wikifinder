export function calculateScore(guessCount: number, completed: boolean): number {
    if (!completed || guessCount > 400) return 0
    const wRaw = Math.max(0, guessCount - 45)
    const w = wRaw / (400 - 45)
    return Math.round(5000 * Math.exp(-3.5 * w))
}

// Phase 3 MODE-04 (D-09/D-10/D-11): survival chain scoring.
// Formula: Σ(articleScores) × (1 + chainLength × 0.1). Give-up articles
// contribute 0 to the sum but count toward chainLength for the multiplier (D-10).
// Called by BOTH /api/survival/end (server) AND the client results UI to guarantee
// numeric parity; never re-implement in route/component.
export function calculateSurvivalScore(
    articleScores: number[],
    chainLength: number
): number {
    if (chainLength <= 0) return 0
    const raw = articleScores.reduce((sum, s) => sum + (s ?? 0), 0)
    const multiplier = 1 + chainLength * 0.1
    return Math.round(raw * multiplier)
}
