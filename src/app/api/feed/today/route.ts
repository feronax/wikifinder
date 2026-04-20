import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// FK auto-name discovered in Plan 05-02 Probe P3 (see 05-02-SUMMARY.md).
// Used to disambiguate the follows→profiles embed (follows has two FKs to profiles).
const FK_FOLLOWEE = 'follows_followee_id_fkey'

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  // D-07: lang from ?lang= query param, default 'fr'.
  // NOTE: profiles.lang_pref does NOT exist (per 05-02-SUMMARY.md Audit A).
  // Carry-forward from 05-02: do not query profiles.lang_pref.
  const url = new URL(req.url)
  const langOverride = url.searchParams.get('lang')
  const lang: 'fr' | 'en' = langOverride === 'en' ? 'en' : 'fr'

  const today = new Date().toISOString().split('T')[0]

  // Embed strategy — scoped to requester's follows, today's page, and lang.
  // Falls back to empty entries on error (graceful degradation — empty is valid UX).
  const { data, error } = await supabase
    .from('follows')
    .select(`
      followee_id,
      profiles:profiles!${FK_FOLLOWEE} (
        id, username,
        games!inner (
          id, guess_count, score, completed_at, won, lang,
          pages!inner ( date )
        )
      )
    `)
    .eq('follower_id', user.id)
    .eq('profiles.games.pages.date', today)
    .eq('profiles.games.lang', lang)
    .limit(30)

  if (error) {
    console.error('[feed/today] embed failed', error.message)
    return NextResponse.json(
      { entries: [], followCount: 0 },
      { status: 200, headers: { 'Cache-Control': 'private, max-age=30' } },
    )
  }

  // Denormalize + exclude self (Claude's Discretion: "feed of friends")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries = (data ?? []).flatMap((row: any) => {
    const p = row.profiles
    if (!p || !p.games?.length) return []
    if (p.id === user.id) return [] // exclude self
    const g = p.games[0]
    return [{
      userId: p.id,
      username: p.username,
      guessCount: g.guess_count ?? 0,
      score: g.score ?? null,
      completedAt: g.completed_at ?? null,
      won: !!g.won,
    }]
  }).sort((a, b) => {
    // completed_at DESC NULLS LAST, username ASC
    if (a.completedAt && !b.completedAt) return -1
    if (!a.completedAt && b.completedAt) return 1
    if (a.completedAt && b.completedAt) {
      const cmp = b.completedAt.localeCompare(a.completedAt)
      if (cmp !== 0) return cmp
    }
    return a.username.localeCompare(b.username)
  })

  // RLS belt-and-suspenders: .eq('follower_id', user.id) ensures we only count
  // follows owned by the requester even if a policy regression occurs.
  const { count: followCount, error: countErr } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', user.id)

  if (countErr) console.error('[feed/today] count failed', countErr.message)

  return NextResponse.json(
    { entries, followCount: followCount ?? 0 },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  )
}
