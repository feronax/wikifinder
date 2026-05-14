/**
 * Phase 22 — Load-bearing SC-1 enforcement (HASH-CONSOLIDATE).
 *
 * Walks every route under wikifinder/src/app/api/**\/route.ts and asserts none of
 * them contain an inline hash-set construction loop. The signature looked for is
 * the JOINT presence of:
 *   - createHash('sha256').update(...)
 *   - a for-loop over fullTokens / fullTitleTokens / tokens / titleTokens
 * in the same file. Bare createHash usage (e.g. ipHash, browserHash in
 * /api/ranked/start) is allowed — only the paired pattern fails.
 *
 * Why this exists: hash-paths-parity.test.ts holds structural copies of the OLD
 * inline blocks (D-04 regression guard). Those copies are tautological now and
 * could be deleted in a future phase. This meta-test survives that deletion: it
 * scans live route source, so silently re-inlining a hash loop will fail CI here.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'

function walkRouteFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walkRouteFiles(full, out)
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      out.push(full)
    }
  }
  return out
}

describe('Phase 22 SC-1: no inline hash-loops in API routes', () => {
  it('no API route contains an inline hash-set construction loop', () => {
    // From wikifinder/src/lib/, walk up to wikifinder/src/app/api/
    const apiRoot = resolve(__dirname, '..', 'app', 'api')
    const routes = walkRouteFiles(apiRoot)
    expect(routes.length).toBeGreaterThan(0) // sanity: we found routes at all

    const inlineHashCall = /createHash\(['"]sha256['"]\)\.update\(/
    const tokenLoop = /for\s*\(\s*const\s+\w+\s+of\s+(fullTokens|fullTitleTokens|tokens|titleTokens)\b/

    const offenders: string[] = []
    for (const file of routes) {
      const src = readFileSync(file, 'utf8')
      if (inlineHashCall.test(src) && tokenLoop.test(src)) {
        offenders.push(file)
      }
    }
    expect(offenders, `Inline hash-loop re-introduced in:\n${offenders.join('\n')}\nUse computeWordHashSet from @/lib/client-hash instead.`).toEqual([])
  })
})
