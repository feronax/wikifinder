/**
 * Phase 11 / FR-02 — friends list endpoint.
 *
 * GET /api/friends
 * - Auth required (401 when anon).
 * - Returns follow list with per-followee status (online / playing / last_played / never),
 *   last_activity_at (ISO, nullable), today_score (nullable), today_rank (null for now).
 * - D-04 compliant: last_activity_at is only returned for rows the caller proved they follow
 *   (two-step follows → profiles pattern, Pitfall 3).
 * - D-05 thresholds: online = last_activity_at < 5 min ago; playing overrides when a games row
 *   for today's page exists (not completed).
 *
 * Schema note: the `games` table has no `date` column. We derive "today" via
 *   `pages.date = YYYY-MM-DD` → `pages.id` → `games.page_id`. Canonical pattern:
 *   - today's page: api/duel/create/route.ts:28-35
 *   - games by page_id: api/history/route.ts:45-49
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { calculateScore } from '@/lib/scoring'

const FIVE_MIN_MS = 5 * 60 * 1000

export async function GET(_req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  // Step 1 — follows (RLS permits own-row SELECT).
  const { data: followRows, error: followErr } = await supabase
    .from('follows')
    .select('followee_id, created_at')
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false })

  if (followErr) {
    console.error('[friends] follows fetch failed', followErr.message)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  const followeeIds = (followRows ?? []).map(r => r.followee_id)
  if (followeeIds.length === 0) return NextResponse.json({ friends: [] })

  // Step 2 — profiles (only for ids the caller follows; D-04 compliant).
  const { data: profilesData, error: profErr } = await supabase
    .from('profiles')
    .select('id, username, last_activity_at')
    .in('id', followeeIds)

  if (profErr) {
    console.error('[friends] profiles fetch failed', profErr.message)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  // Step 3 — resolve today's page_id via pages.date (games table has no `date` column).
  // Pattern from api/duel/create/route.ts:28-35.
  const today = new Date().toISOString().slice(0, 10)
  const { data: todayPage } = await supabase
    .from('pages')
    .select('id')
    .eq('date', today)
    .maybeSingle()

  // Step 4 — today's games for these followees (scoped to today's page_id).
  // If todayPage is null (edge case: pre-cron / seed miss), skip games entirely.
  const byUser = new Map<string, { guess_count: number; completed: boolean; duration_seconds: number }>()
  if (todayPage?.id) {
    const { data: todayGamesData } = await supabase
      .from('games')
      .select('user_id, page_id, guess_count, completed, duration_seconds')
      .in('user_id', followeeIds)
      .eq('page_id', todayPage.id)
    for (const g of todayGamesData ?? []) {
      byUser.set(g.user_id, { guess_count: g.guess_count, completed: g.completed, duration_seconds: g.duration_seconds })
    }
  }

  const now = Date.now()
  const friends = (profilesData ?? []).map(p => {
    const g = byUser.get(p.id)
    const todayScore = g && g.completed ? calculateScore(g.guess_count, true) : null
    let status: 'online' | 'playing' | 'last_played' | 'never'
    if (g && !g.completed) {
      status = 'playing'
    } else if (p.last_activity_at && (now - new Date(p.last_activity_at).getTime() < FIVE_MIN_MS)) {
      status = 'online'
    } else if (p.last_activity_at) {
      status = 'last_played'
    } else {
      status = 'never'
    }
    return {
      user_id: p.id,
      pseudonym: p.username,
      avatar_initial: (p.username?.[0] ?? '?').toUpperCase(),
      status,
      last_activity_at: p.last_activity_at,
      today_score: todayScore,
      today_rank: null as number | null,  // Phase 11 v1: rank computation deferred to client or future plan
    }
  })

  // Preserve follow-recency order from step 1.
  const idOrder = new Map(followeeIds.map((id, i) => [id, i]))
  friends.sort((a, b) => (idOrder.get(a.user_id) ?? 0) - (idOrder.get(b.user_id) ?? 0))

  return NextResponse.json({ friends })
}
