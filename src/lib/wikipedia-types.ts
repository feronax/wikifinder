/**
 * Type contracts for MediaWiki Action API + Pageviews REST API + adapted DB rows.
 *
 * Hand-written rather than auto-generated:
 * - The MediaWiki API surface is enormous; we only consume ~5 fields per call.
 * - Cron paths can tolerate upstream drift (retries built in); typed interfaces
 *   surface breaking changes at compile time without adding a runtime failure mode.
 *
 * If a future feature needs broader coverage, expand these incrementally — do
 * NOT replace with a `wikipedia-api-types` package (CONTEXT.md HARD-07: prefer
 * hand-written for the narrow surface this codebase touches).
 */

// =====================================================================
// MediaWiki Action API — `action=query`
// Reference: https://www.mediawiki.org/wiki/API:Query
// Note: the API uses string-keyed `pages` objects (page IDs as keys).
// Use `Object.values(data.query.pages)[0]` to extract the single page.
// =====================================================================

export interface MediaWikiPage {
  pageid: number
  ns: number
  title: string
  fullurl?: string       // present when prop=info&inprop=url
  extract?: string       // present when prop=extracts&explaintext=true
  langlinks?: Array<{
    lang: string
    '*': string          // article title in the target language
  }>
}

export interface MediaWikiQueryResponse {
  query: {
    pages: Record<string, MediaWikiPage>
    random?: Array<{ id: number; ns: number; title: string }>  // present for list=random
  }
  continue?: { llcontinue?: string; continue?: string }
}

// =====================================================================
// Wikimedia REST Pageviews API
// Reference: https://wikimedia.org/api/rest_v1/
// =====================================================================

export interface PageviewsResponse {
  items?: Array<{
    project: string
    article: string
    granularity: 'monthly' | 'daily'
    timestamp: string
    access: string
    agent: string
    views: number
  }>
}

// =====================================================================
// Adapted DB row shapes — narrow Picks of `ranked_pages` and `guesses`
// used internally by the guess/proximity/today route handlers.
// =====================================================================

/**
 * `ranked_pages` row shape used by the guess and proximity Route Handlers.
 * Replaces `as any` casts at:
 *   - app/api/game/guess/route.ts:51 (rankedPageResult.data)
 *   - app/api/game/proximity/route.ts:45-46 (rankedPage)
 *
 * Note: callers select narrow column projections (per HARD-03 / Plan 01),
 * so use `Pick<RankedPageRow, ...>` at the call site to match the actual
 * select.
 *
 * The per-language duplication on guess/route.ts:53-62 is a pre-existing
 * bug (same value assigned to both _fr and _en branches) — HARD-07 removes
 * the cast but does NOT fix the mapping (deferred per CONTEXT.md).
 */
export interface RankedPageRow {
  id: string
  lang: 'fr' | 'en'
  difficulty: string
  wikipedia_title: string
  wikipedia_url: string
  content: string
  tokens: unknown[]        // JSONB array — actual element shape lives in lib/tokenize.ts
  title_tokens: unknown[]
  used_count: number
}

/**
 * `guesses` row shape used by the today Route Handler when only the `word`
 * and `guessed_at` columns are selected.
 * Replaces `as any` cast at app/api/game/today/route.ts:129.
 */
export interface GuessRow {
  word: string
  guessed_at: string
}
