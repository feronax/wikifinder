'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import Header from '@/components/Header'
import TodayFeedCard from '@/components/feed/TodayFeedCard'
import FollowSearchInput from '@/components/feed/FollowSearchInput'
import FollowButton from '@/components/feed/FollowButton'

type Follow = { id: string; username: string }

export default function FriendsPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [follows, setFollows] = useState<Follow[] | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.replace('/login?next=/friends')
        return
      }
      setAuthed(true)
      setChecking(false)
      // Fetch the list of users this viewer follows via two simple queries.
      // RLS on `follows` permits own-row SELECT (follower_id = auth.uid()).
      // "Lecture publique des profils" policy on profiles permits authed reads.
      // Embed-based approach failed silently on the browser client because the
      // FK follows.followee_id → auth.users (not profiles) — PostgREST couldn't
      // resolve `profiles!follows_followee_id_fkey` without an alias on this path.
      const { data: rows } = await supabase
        .from('follows')
        .select('followee_id, created_at')
        .eq('follower_id', data.user.id)
        .order('created_at', { ascending: false })
      const followeeIds = (rows ?? []).map((r: { followee_id: string }) => r.followee_id)
      if (followeeIds.length === 0) {
        setFollows([])
        return
      }
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', followeeIds)
      // Preserve original order (most-recent follow first).
      const byId = new Map<string, Follow>()
      for (const p of (profilesData ?? []) as Follow[]) byId.set(p.id, p)
      const list: Follow[] = followeeIds.map(id => byId.get(id)).filter((p): p is Follow => !!p)
      setFollows(list)
    })()
  }, [])

  if (checking || !authed) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <Header lang={lang} onLangChange={setLang} />
      </div>
    )
  }

  const title = lang === 'fr' ? 'Amis' : 'Friends'
  const searchLabel = lang === 'fr' ? 'Trouver des joueurs' : 'Find players'
  const followingLabel = lang === 'fr' ? 'Tu suis' : 'Following'
  const emptyFollows = lang === 'fr'
    ? 'Tu ne suis personne pour l\u2019instant.'
    : 'You don\u2019t follow anyone yet.'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header lang={lang} onLangChange={setLang} />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ margin: '0 0 24px 0', fontSize: 28, color: 'var(--text)' }}>{title}</h1>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>
            {searchLabel}
          </div>
          <FollowSearchInput lang={lang} />
        </div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 500 }}>
            {followingLabel} {follows && follows.length > 0 && <span style={{ color: 'var(--text-muted)' }}>({follows.length})</span>}
          </div>
          {follows === null ? (
            <div className="skeleton" style={{ height: 60, borderRadius: 8 }} />
          ) : follows.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>{emptyFollows}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {follows.map(f => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 8,
                  backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: 'var(--accent)', color: 'var(--surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13,
                  }}>
                    {f.username.slice(0, 2).toUpperCase()}
                  </div>
                  <a href={`/player/${encodeURIComponent(f.username)}`} style={{
                    flex: 1, color: 'var(--text)', textDecoration: 'none', fontWeight: 500, fontSize: 15,
                    minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.username}
                  </a>
                  <FollowButton targetUserId={f.id} initialState="following" lang={lang} />
                </div>
              ))}
            </div>
          )}
        </div>

        <TodayFeedCard lang={lang} />
      </div>
    </div>
  )
}
