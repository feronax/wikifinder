'use client'

import { useEffect, useState } from 'react'
import FeedRow, { type FeedEntry } from './FeedRow'
import FollowSearchInput from './FollowSearchInput'

type Props = { lang: 'fr' | 'en' }
type State =
  | { status: 'loading' }
  | { status: 'unauth' } // D-09: never render for anon
  | { status: 'ready'; entries: FeedEntry[]; followCount: number }

/**
 * Slice 2 feed surface (D-06). Client component — mounted inside landing.tsx
 * which is already `'use client'`. A future refactor (Strategy A in 05-04-PLAN)
 * would move this to RSC; for v1 we fetch /api/feed/today from the client using
 * the existing auth cookie.
 */
export default function TodayFeedCard({ lang }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/feed/today?lang=${lang}`, { cache: 'no-store' })
        if (cancelled) return
        if (res.status === 401) {
          setState({ status: 'unauth' })
          return
        }
        if (!res.ok) {
          setState({ status: 'ready', entries: [], followCount: 0 })
          return
        }
        const body = await res.json()
        setState({
          status: 'ready',
          entries: Array.isArray(body.entries) ? body.entries : [],
          followCount: typeof body.followCount === 'number' ? body.followCount : 0,
        })
      } catch {
        if (!cancelled) setState({ status: 'ready', entries: [], followCount: 0 })
      }
    })()
    return () => { cancelled = true }
  }, [lang])

  // D-09: logged-out users see nothing.
  if (state.status === 'unauth') return null

  const heading = lang === 'fr' ? "Aujourd'hui" : 'Today'
  const emptyTitle = lang === 'fr' ? 'Trouve des joueurs à suivre.' : 'Find players to follow.'
  const noPlaysBody = lang === 'fr'
    ? "Tes amis n'ont pas encore joué aujourd'hui."
    : "Friends haven't played today's article yet."

  if (state.status === 'loading') {
    // Skeleton: small surface block so layout doesn't jump.
    return (
      <section
        aria-busy="true"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          minHeight: 96,
        }}
      />
    )
  }

  const { entries, followCount } = state
  const populated = entries.length > 0
  const hasFollowsNoPlays = !populated && followCount > 0
  const empty = !populated && followCount === 0

  return (
    <section
      style={{
        background: populated ? 'var(--bg-secondary)' : 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: populated ? '3px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2, margin: 0, color: 'var(--text)' }}>
          {heading}
        </h2>
      </header>

      {populated && (
        <div role="list">
          {entries.map((e) => <FeedRow key={e.userId} entry={e} lang={lang} />)}
        </div>
      )}
      {hasFollowsNoPlays && (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>{noPlaysBody}</p>
      )}
      {empty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, color: 'var(--text)' }}>{emptyTitle}</p>
          <FollowSearchInput lang={lang} />
        </div>
      )}
    </section>
  )
}
