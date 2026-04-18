import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Shape returned by pickNextSurvivalPage — minimum columns routes need to
 * mask tokens + send the wikipedia_url to the client. `tokens` and
 * `title_tokens` are pre-resolved to the selected language. Kept loose
 * (`any` for JSONB blobs) because no `Database` types are generated in
 * this project.
 */
export interface SurvivalPoolPage {
  id: string
  wikipedia_title: string
  wikipedia_url: string
  tokens: any
  title_tokens: any
}

/**
 * The `pages` table is schema-wise bilingual: a single row holds both FR and
 * EN content in suffixed columns (`wikipedia_title_fr`/`wikipedia_title_en`,
 * `tokens_fr`/`tokens_en`, etc.) keyed by `date`. Survival runs are
 * single-language (D-07), so we SELECT both sides then project to the chosen
 * language before returning. This keeps the rest of the route code language-
 * agnostic and matches how /api/game/today + /api/ranked/start project.
 *
 * Note: NO `lang` column exists on `pages` (verified 2026-04-18 via grep
 * across all pages-consumers). D-06 never-repeat uses `games.page_id` —
 * page_id identifies the bilingual row, so a FR play in one run still excludes
 * the same row from an EN run. That's the intended behavior for D-06 ("any
 * mode" plays count).
 */
interface BilingualPageRow {
  id: string
  wikipedia_title_fr: string | null
  wikipedia_title_en: string | null
  wikipedia_url_fr: string | null
  wikipedia_url_en: string | null
  tokens_fr: any
  tokens_en: any
  title_tokens_fr: any
  title_tokens_en: any
  date?: string
}

function projectToLang(row: BilingualPageRow, lang: 'fr' | 'en'): SurvivalPoolPage {
  return {
    id: row.id,
    wikipedia_title: (lang === 'fr' ? row.wikipedia_title_fr : row.wikipedia_title_en) ?? '',
    wikipedia_url: (lang === 'fr' ? row.wikipedia_url_fr : row.wikipedia_url_en) ?? '',
    tokens: (lang === 'fr' ? row.tokens_fr : row.tokens_en) ?? [],
    title_tokens: (lang === 'fr' ? row.title_tokens_fr : row.title_tokens_en) ?? [],
  }
}

const BILINGUAL_SELECT =
  'id, wikipedia_title_fr, wikipedia_title_en, wikipedia_url_fr, wikipedia_url_en, ' +
  'tokens_fr, tokens_en, title_tokens_fr, title_tokens_en, date'

/**
 * Pick the next survival article for a user.
 *
 * - userId === null (anonymous): samples up to the 50 most recent dailies
 *   and picks one in-memory. No never-repeat filter (no user to attribute
 *   plays to).
 * - userId set (authed): filter out `excludePageIds` + every page_id the user
 *   has ever played across any mode (D-06 never-repeat). If the eligible set
 *   is empty (pool exhausted), fall back to oldest-first by `date ASC`.
 *
 * Returns null only if the `pages` table is empty entirely (catastrophic —
 * surfaces as 500 to the caller).
 */
export async function pickNextSurvivalPage(
  userId: string | null,
  lang: 'fr' | 'en',
  excludePageIds: Set<string>
): Promise<SurvivalPoolPage | null> {
  // Anonymous path — single round-trip, no played-set subquery.
  if (!userId) {
    const { data, error } = await supabaseAdmin
      .from('pages')
      .select(BILINGUAL_SELECT)
      .order('date', { ascending: false })
      .limit(50)
    if (error || !data || data.length === 0) return null
    const row = data[Math.floor(Math.random() * data.length)] as unknown as BilingualPageRow
    return projectToLang(row, lang)
  }

  // Authed path — build played-set from games (any mode counts per D-06).
  const { data: played } = await supabaseAdmin
    .from('games')
    .select('page_id')
    .eq('user_id', userId)
  const playedSet = new Set<string>(
    (played ?? [])
      .map((r: any) => r.page_id as string | null)
      .filter((id: any): id is string => !!id)
  )
  for (const id of excludePageIds) playedSet.add(id)

  const { data: pool, error } = await supabaseAdmin
    .from('pages')
    .select(BILINGUAL_SELECT)
    .order('date', { ascending: true })
  if (error) return null
  if (!pool || pool.length === 0) return null

  const eligible = (pool as unknown as BilingualPageRow[]).filter(p => !playedSet.has(p.id))
  if (eligible.length > 0) {
    const row = eligible[Math.floor(Math.random() * eligible.length)]
    return projectToLang(row, lang)
  }
  // D-06 never-repeat fallback: oldest-first when pool exhausted.
  return projectToLang((pool as unknown as BilingualPageRow[])[0], lang)
}
