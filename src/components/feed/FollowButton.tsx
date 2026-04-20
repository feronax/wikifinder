'use client'

import { useState, useTransition } from 'react'

type Props = {
  targetUserId: string
  initialState: 'follow' | 'following'
  lang?: 'fr' | 'en'
}

export default function FollowButton({ targetUserId, initialState, lang = 'fr' }: Props) {
  const [state, setState] = useState<'follow' | 'following'>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const labels = lang === 'fr'
    ? { follow: 'Suivre', following: 'Suivi', err: 'Erreur, réessaie' }
    : { follow: 'Follow', following: 'Following', err: 'Error, try again' }

  function toggle() {
    const prev = state
    const next: 'follow' | 'following' = state === 'follow' ? 'following' : 'follow'
    const method = next === 'following' ? 'POST' : 'DELETE'
    // Optimistic (D-05)
    setState(next)
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/follows', {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ followeeId: targetUserId }),
        })
        if (!res.ok) throw new Error(`${res.status}`)
      } catch {
        setState(prev)
        setError(labels.err)
      }
    })
  }

  const isFollowing = state === 'following'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isFollowing}
      style={{
        minHeight: 44,
        padding: '0 16px',
        borderRadius: 8,
        border: '1px solid var(--accent)',
        background: isFollowing ? 'transparent' : 'var(--accent)',
        color: isFollowing ? 'var(--accent)' : 'var(--surface)',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {isFollowing ? labels.following : labels.follow}
      {error && (
        <span style={{ marginLeft: 8, color: 'var(--destructive)', fontSize: 14 }}>{error}</span>
      )}
    </button>
  )
}
