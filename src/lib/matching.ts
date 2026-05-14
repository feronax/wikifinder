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
    // FR -al/-aux exception list — these words take REGULAR -s plurals (bals,
    // carnavals, festivals, récitals, régals), NOT -aux. Short-circuit BEFORE
    // the generic aux/al rule fires so wordsMatch('bal','baux') stays false
    // (the generic rule would otherwise match since 'baux'.slice(0,-3)+'al' = 'bal').
    const frAlExceptions = new Set(['bal', 'carnaval', 'festival', 'recital', 'regal'])
    if (normToken.endsWith('aux') && frAlExceptions.has(normToken.slice(0, -3) + 'al')) {
        // intentionally fall through (skip aux/al), let +s handle bals/carnavals/etc.
    } else if (normToken.endsWith('aux') && normInput === normToken.slice(0, -3) + 'al') return true
    if (normInput.endsWith('aux') && frAlExceptions.has(normInput.slice(0, -3) + 'al')) {
        // intentionally fall through
    } else if (normInput.endsWith('aux') && normToken === normInput.slice(0, -3) + 'al') return true

    // EN irregular plurals — f/fe → ves (knife↔knives, leaf↔leaves, wife↔wives)
    if (normToken.endsWith('ves') && normInput === normToken.slice(0, -3) + 'fe') return true
    if (normInput.endsWith('ves') && normToken === normInput.slice(0, -3) + 'fe') return true
    if (normToken.endsWith('ves') && normInput === normToken.slice(0, -3) + 'f') return true
    if (normInput.endsWith('ves') && normToken === normInput.slice(0, -3) + 'f') return true

    // EN irregular plurals — man → men (man↔men, woman↔women)
    if (normToken.endsWith('men') && normInput === normToken.slice(0, -3) + 'man') return true
    if (normInput.endsWith('men') && normToken === normInput.slice(0, -3) + 'man') return true

    // EN irregular plurals — explicit vowel-change pairs
    if ((normInput === 'child' && normToken === 'children') || (normToken === 'child' && normInput === 'children')) return true
    if ((normInput === 'tooth' && normToken === 'teeth') || (normToken === 'tooth' && normInput === 'teeth')) return true
    if ((normInput === 'foot' && normToken === 'feet') || (normToken === 'foot' && normInput === 'feet')) return true
    if ((normInput === 'mouse' && normToken === 'mice') || (normToken === 'mouse' && normInput === 'mice')) return true
    if ((normInput === 'goose' && normToken === 'geese') || (normToken === 'goose' && normInput === 'geese')) return true

    // EN verb inflection — +ing simple (walk↔walking)
    if (normToken === normInput + 'ing') return true
    if (normInput === normToken + 'ing') return true

    // EN verb inflection — +ed simple (walk↔walked)
    if (normToken === normInput + 'ed') return true
    if (normInput === normToken + 'ed') return true

    // EN verb inflection — e-drop +ing (love↔loving: remove trailing 'e', add 'ing')
    if (normInput.endsWith('e') && normToken === normInput.slice(0, -1) + 'ing') return true
    if (normToken.endsWith('e') && normInput === normToken.slice(0, -1) + 'ing') return true

    // EN verb inflection — e-drop +d (love↔loved: input ends in 'e', add 'd')
    if (normInput.endsWith('e') && normToken === normInput + 'd') return true
    if (normToken.endsWith('e') && normInput === normToken + 'd') return true

    // EN verb inflection — explicit stem-doubling pairs (D-04: explicit list, no CVC heuristic)
    const doublingStemPairs: [string, string][] = [
        ['run', 'running'], ['get', 'getting'], ['hit', 'hitting'],
        ['sit', 'sitting'], ['swim', 'swimming'], ['begin', 'beginning'],
        ['put', 'putting'], ['cut', 'cutting'], ['set', 'setting'],
    ]
    for (const [base, inflected] of doublingStemPairs) {
        if ((normInput === base && normToken === inflected) || (normToken === base && normInput === inflected)) return true
    }

    // FR verb inflection — -er infinitive ↔ past participle
    // normalize('mangé') = 'mange', normalize('manger') = 'manger'
    // Rule: normToken === normInput + 'r' means normToken is the infinitive, normInput is pp normalized
    if (normToken === normInput + 'r') return true
    if (normInput === normToken + 'r') return true

    // ===== Phase 21-01: FR irregular plurals =====
    // NB: the generic -al/-aux rule above already handles cheval/chevaux,
    // journal/journaux, animal/animaux (slice(0,-3)+'al' yields the correct
    // singular). Its -al exception list (frAlExceptions) keeps bal/baux et al.
    // from spuriously matching.
    // The +s and +x rules above cover the -al exception plurals (bals, etc.)
    // and the -ou exception plurals (genoux, cailloux, hiboux, bijoux, choux,
    // joujoux, poux) bidirectionally — no new branch needed for those.
    // We explicitly enumerate them anyway so variantsOf() can mirror the set,
    // plus the truly irregular pairs (travail/travaux, vowel-changes).
    // normalize('œil') keeps U+0153 (NFD does not decompose it); list both
    // 'œil' and 'oeil' so guesses typed either way match.
    const frIrregularPluralPairs: [string, string][] = [
        // -ou exception list (covered by +x; listed here for semantic intent + variantsOf mirror)
        ['genou', 'genoux'], ['caillou', 'cailloux'], ['hibou', 'hiboux'],
        ['bijou', 'bijoux'], ['chou', 'choux'], ['joujou', 'joujoux'], ['pou', 'poux'],
        // travail/travaux — NOT covered by generic aux/al rule (slice drops 3, would need to drop 4)
        ['travail', 'travaux'],
        // Vowel-change pairs (no regex rule covers these)
        ['œil', 'yeux'], ['oeil', 'yeux'],
        ['ciel', 'cieux'],
    ]
    for (const [base, plural] of frIrregularPluralPairs) {
        if ((normInput === base && normToken === plural) || (normToken === base && normInput === plural)) return true
    }

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
