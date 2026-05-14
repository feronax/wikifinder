/**
 * Logique de matching partagée entre client et serveur.
 * Ne contient aucune dépendance spécifique à Node ou au navigateur.
 */

export function normalize(word: string): string {
    return word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * FR named-irregular verbs. Each row is an equivalence class \u2014 any pair of
 * forms in the same row counts as a wordsMatch().
 *
 * Forms included per row (where applicable):
 *   [infinitive, past-participle, present-participle, 3sg-present, 3sg-imperfect]
 *
 * Coverage is intentionally limited to forms that show up in encyclopedic prose
 * (Wikipedia articles). Full conjugations (je/tu/nous/vous, all tenses) are
 * out of scope \u2014 the matcher targets reading comprehension, not grammar drill.
 *
 * IMPORTANT: any -re verb in this table is implicitly EXEMPT from the generic
 * -re/-u rule (see the rule's guard below). Adding a new -re verb here without
 * adding its non-regular past participle WILL break that verb's matching.
 */
export const frIrregularVerbs: readonly string[][] = [
    ['\u00eatre',    '\u00e9t\u00e9',     '\u00e9tant',    'est',    '\u00e9tait'],
    ['avoir',   'eu',      'ayant',    'a',      'avait'],
    ['aller',   'all\u00e9',    'allant',   'va',     'allait'],
    ['faire',   'fait',    'faisant',  'fait',   'faisait'],
    ['dire',    'dit',     'disant',   'dit',    'disait'],
    ['voir',    'vu',      'voyant',   'voit',   'voyait'],
    ['savoir',  'su',      'sachant',  'sait',   'savait'],
    ['pouvoir', 'pu',      'pouvant',  'peut',   'pouvait'],
    ['vouloir', 'voulu',   'voulant',  'veut',   'voulait'],
    ['devoir',  'd\u00fb',      'devant',   'doit',   'devait'],
    ['venir',   'venu',    'venant',   'vient',  'venait'],
    ['tenir',   'tenu',    'tenant',   'tient',  'tenait'],
    ['prendre', 'pris',    'prenant',  'prend',  'prenait'],
    ['mettre',  'mis',     'mettant',  'met',    'mettait'],
    ['vivre',   'v\u00e9cu',    'vivant',   'vit',    'vivait'],
    ['na\u00eetre',  'n\u00e9',      'naissant', 'na\u00eet',   'naissait'],
    ['mourir',  'mort',    'mourant',  'meurt',  'mourait'],
    ['boire',   'bu',      'buvant',   'boit',   'buvait'],
    ['croire',  'cru',     'croyant',  'croit',  'croyait'],
    ['lire',    'lu',      'lisant',   'lit',    'lisait'],
    ['\u00e9crire',  '\u00e9crit',   '\u00e9crivant', '\u00e9crit',  '\u00e9crivait'],
]

/** Pre-built lookup: normalized form \u2192 set of all other normalized forms in
 *  its equivalence class. Built ONCE at module load (O(1) lookup at runtime). */
const frIrregularLookup: Map<string, Set<string>> = (() => {
    const m = new Map<string, Set<string>>()
    for (const row of frIrregularVerbs) {
        const normRow = row.map(f => normalize(f))
        for (const form of normRow) {
            const existing = m.get(form) ?? new Set<string>()
            for (const other of normRow) {
                if (other !== form) existing.add(other)
            }
            m.set(form, existing)
        }
    }
    return m
})()

/** Set of -re infinitives in the irregular table. The generic -re/-u rule
 *  must NOT fire when either side normalizes to a member of this set,
 *  otherwise 'prendre' \u2192 'prendu' would spuriously match. */
const frIrregularReInfinitives: Set<string> = new Set(
    frIrregularVerbs
        .map(row => normalize(row[0]))
        .filter(inf => inf.endsWith('re'))
)

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
    // -aux (m.pl) ↔ -ales (f.pl). Bridges animaux ↔ animales (different inflection
    // axes: m.pl is irregular -aux, f.pl regularizes from f.sg animale + s).
    if (normInput.endsWith('aux') && normInput.length >= 5 && normToken === normInput.slice(0, -3) + 'ales') return true
    if (normToken.endsWith('aux') && normToken.length >= 5 && normInput === normToken.slice(0, -3) + 'ales') return true
    // -ale (f.sg) ↔ -aux (m.pl). animale ↔ animaux cross-axis in irregular -al family.
    if (normInput.endsWith('ale') && normInput.length >= 4 && normToken === normInput.slice(0, -3) + 'aux') return true
    if (normToken.endsWith('ale') && normToken.length >= 4 && normInput === normToken.slice(0, -3) + 'aux') return true

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

    // FR verb inflection — -er infinitive ↔ past participle (and adjectival agreement)
    // normalize('mangé')='mange', normalize('manger')='manger', normalize('mangés')='manges',
    // normalize('mangée')='mangee', normalize('mangées')='mangees'.
    // Bare-pp rule (mangé ↔ manger):
    if (normToken === normInput + 'r') return true
    if (normInput === normToken + 'r') return true
    // Past-participle agreement (-é, -és, -ée, -ées). The +s/+es plural rules above
    // can't bridge these because the infinitive ends in 'r'. Length guard >2 mirrors
    // wordsMatch's other -er guards and keeps short words ('or', 'er') from spuriously
    // matching 2-char stems.
    if (normInput.endsWith('r') && normInput.length > 2) {
        const base = normInput.slice(0, -1)
        if (normToken === base + 's' || normToken === base + 'e' || normToken === base + 'es') return true
    }
    if (normToken.endsWith('r') && normToken.length > 2) {
        const base = normToken.slice(0, -1)
        if (normInput === base + 's' || normInput === base + 'e' || normInput === base + 'es') return true
    }

    // FR adjectival / past-participle agreement (m ↔ f, sg ↔ pl).
    // Covers: créé↔créée, différent↔différente, animal↔animale, fort↔forte,
    //         créés↔créées, différents↔différentes, créée↔créés, etc.
    // Length guard ≥4 on the shorter side blocks ami/amie, fil/file, ros/rose
    // false positives. Accepts some rare false matches (porte/ports, rose/rosée)
    // — acceptable forgiveness for a word game per Phase 21-04 decision.
    // m.sg ↔ f.sg: X ↔ X+e
    if (normInput.length >= 4 && normToken === normInput + 'e') return true
    if (normToken.length >= 4 && normInput === normToken + 'e') return true
    // m.pl ↔ f.pl: X+s ↔ X+es (i.e. f.pl has extra 'e' before final 's')
    if (normInput.endsWith('s') && normInput.length >= 5 && normToken === normInput.slice(0, -1) + 'es') return true
    if (normToken.endsWith('s') && normToken.length >= 5 && normInput === normToken.slice(0, -1) + 'es') return true
    // f.sg ↔ m.pl: X+e ↔ X+s (cross-axis: replace trailing 'e' with 's')
    if (normInput.endsWith('e') && normInput.length >= 4 && normToken === normInput.slice(0, -1) + 's') return true
    if (normToken.endsWith('e') && normToken.length >= 4 && normInput === normToken.slice(0, -1) + 's') return true

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

    // ===== Phase 21-02: FR verb inflection beyond -er =====
    // NB: The -ir/-i past participle is already covered by the existing ±'r' rule
    // above (normalize('fini')='fini', 'fini'+'r'='finir'). Verified empirically
    // pre-implementation; no dedicated -ir branch needed. See 21-02 SUMMARY for
    // Risk 1 verdict.

    // Named-irregular equivalence-class lookup — fires FIRST so 'prendre/pris',
    // 'être/est', etc. resolve before the generic -re/-u rule below.
    const inputClass = frIrregularLookup.get(normInput)
    if (inputClass && inputClass.has(normToken)) return true
    const tokenClass = frIrregularLookup.get(normToken)
    if (tokenClass && tokenClass.has(normInput)) return true

    // FR -re → -u past participle (regular). Guard: skip if either side is the
    // infinitive of an irregular -re verb (prendre, mettre, vivre, naître, …)
    // — those were handled by the lookup above; the guard prevents spurious
    // matches like 'prendre' ↔ 'prendu'.
    if (
        normInput.endsWith('re') &&
        normToken === normInput.slice(0, -2) + 'u' &&
        !frIrregularReInfinitives.has(normInput)
    ) return true
    if (
        normToken.endsWith('re') &&
        normInput === normToken.slice(0, -2) + 'u' &&
        !frIrregularReInfinitives.has(normToken)
    ) return true

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
    // Character class: ASCII letters/digits + Latin-1 Supplement letters
    // (À-ÿ = U+00C0..U+00FF) + the o-e ligature pair (Œ = U+0152, œ = U+0153)
    // which sits outside À-ÿ and would otherwise be stripped. Apostrophe and
    // hyphen are kept for contractions and compound words.
    return value.replace(/[^a-zA-ZÀ-ÿœŒ0-9'-]/g, '')
}
