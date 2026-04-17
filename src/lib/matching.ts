/**
 * Logique de matching partagée entre client et serveur.
 * Ne contient aucune dépendance spécifique à Node ou au navigateur.
 */

export function normalize(word: string): string {
    return word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function wordsMatch(input: string, token: string): boolean {
    const normInput = normalize(input)
    const normToken = normalize(token)
    if (normInput === normToken) return true
    if (normToken === normInput + 's') return true
    if (normToken === normInput + 'x') return true
    if (normToken === normInput + 'es') return true
    if (normInput === normToken + 's') return true
    if (normInput === normToken + 'x') return true
    if (normInput === normToken + 'es') return true
    if (normToken.endsWith('aux') && normInput === normToken.slice(0, -3) + 'al') return true
    if (normInput.endsWith('aux') && normToken === normInput.slice(0, -3) + 'al') return true
    return false
}

export function splitOnApostrophe(word: string): string[] {
    // ASCII apostrophe (U+0027) + left curly (U+2018) + right curly (U+2019).
    // Mobile autocorrect routinely produces U+2019 — without this, guess matching
    // silently fails on any curly-apostrophe input (e.g. "c\u2019est").
    const parts = word.split(/[\u0027\u2018\u2019]/)
    return parts.filter(p => p.length > 0)
}

export function cleanTokenValue(value: string): string {
    return value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, '')
}
