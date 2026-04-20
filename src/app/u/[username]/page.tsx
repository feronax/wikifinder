import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import FollowButton from '@/components/feed/FollowButton'

/**
 * Slice 2 public profile page (D-11, Option A locked per 05-RESEARCH).
 * Minimal v1: username + avatar initials + Follow/Unfollow. Mode summary
 * (daily/survival/duel) intentionally deferred; the legacy /player/[username]
 * route still exists for richer per-user stats.
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const supabase = await createSupabaseServerClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', username)
    .maybeSingle()

  if (error) console.error('[u/username] profile lookup failed', error.message)
  if (!profile) notFound()

  const { data: { user: viewer } } = await supabase.auth.getUser()
  const isOwn = viewer?.id === profile.id

  // Determine current follow state for the FollowButton.
  let followState: 'follow' | 'following' = 'follow'
  if (viewer && !isOwn) {
    const { data: existing } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', viewer.id)
      .eq('followee_id', profile.id)
      .maybeSingle()
    if (existing) followState = 'following'
  }

  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <section
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            aria-hidden
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              background: 'var(--accent)',
              color: 'var(--surface)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {profile.username.slice(0, 2).toUpperCase()}
          </span>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--text)' }}>
            {profile.username}
          </h1>
          {viewer && !isOwn && (
            <div style={{ marginLeft: 'auto' }}>
              <FollowButton targetUserId={profile.id} initialState={followState} />
            </div>
          )}
        </header>
        {/* v1: minimal body. Mode summary can mirror /player/[username] in a future plan. */}
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>—</p>
      </section>
    </main>
  )
}
