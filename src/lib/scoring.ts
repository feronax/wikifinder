export function calculateScore(guessCount: number, completed: boolean): number {
    if (!completed || guessCount > 400) return 0
    const wRaw = Math.max(0, guessCount - 45)
    const w = wRaw / (400 - 45)
    return Math.round(5000 * Math.exp(-3.5 * w))
}
