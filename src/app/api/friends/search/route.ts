/**
 * Phase 11 / FR-01 — friends search endpoint.
 *
 * GET /api/friends/search?q={query}
 * - Auth required (401 when anon)
 * - Rate-limited: 10 req/min per user
 * - Input: q length 2..32, ilike %/_ escaped (T-05-20)
 * - D-04 projection: SELECT 'id, username' only — NEVER last_activity_at here.
 * - is_followed computed via second query against follows.
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { rateLimitOk } from '@/lib/rate-limit'

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  if (!(await rateLimitOk(user.id, 'friends-search', 10))) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  }

  const url = new URL(req.url)
  const qRaw = url.searchParams.get('q') ?? ''
  if (qRaw.length < 2 || qRaw.length > 32) {
    return NextResponse.json({ results: [] })
  }
  // T-05-20: escape ilike wildcards so `%` / `_` cannot be smuggled in via q.
  const q = qRaw.replace(/[%_]/g, '\\$&')

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')  // D-04: NEVER include last_activity_at here.
    .ilike('username', `${q}%`)
    .neq('id', user.id)
    .limit(10)

  if (error || !data) {
    console.error('[friends/search] failed', error?.message)
    return NextResponse.json({ results: [] })
  }

  // Compute is_followed via second query (Pitfall 3 — follows FK is auth.users, not profiles).
  const ids = data.map(p => p.id)
  let followedSet = new Set<string>()
  if (ids.length > 0) {
    const { data: followRows } = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', user.id)
      .in('followee_id', ids)
    followedSet = new Set((followRows ?? []).map((r: { followee_id: string }) => r.followee_id))
  }

  return NextResponse.json({
    results: data.map(p => ({
      user_id: p.id,
      pseudonym: p.username,
      avatar_initial: (p.username[0] ?? '?').toUpperCase(),
      is_followed: followedSet.has(p.id),
    })),
  })
}
