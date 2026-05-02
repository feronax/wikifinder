'use client'

/**
 * NewFriendsScreen — Phase 11 SCR-04 + FR-03.
 *
 * Search bar (debounced 250ms → /api/friends/search) + follow list
 * (/api/friends). Responsive split (D-03): desktop = dropdown under input;
 * mobile = replace follow list with results panel.
 *
 * Défier CTA (FR-03): anon-guard short-circuits BEFORE fetch using verbatim
 * Phase 10.3-10 toast copy (T-11-23). Authed: POST /api/duel/create with
 * { lang } only (Q4 Path A — body has no opponent id; friend joins via shareable URL).
 *
 * Tokens: --wf-* only. All numbers tabular-nums. Lucide Search icon (no emoji).
 */

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useIsMobile } from '@/lib/utils'
import NewDesignHeader from '@/components/game/new/NewDesignHeader'
import NewSkeleton from '@/components/screens/new/NewSkeleton'
import NewErrorState from '@/components/screens/new/NewErrorState'

type SearchResult = {
  user_id: string
  pseudonym: string
  avatar_initial: string
  is_followed: boolean
}

type Friend = {
  user_id: string
  pseudonym: string
  avatar_initial: string
  status: 'online' | 'playing' | 'last_played' | 'never'
  last_activity_at: string | null
  today_score: number | null
  today_rank: number | null
}

type ToastMsg = { variant: 'error' | 'info'; message: string } | null

const COPY = {
  fr: {
    title: 'Amis',
    searchLabel: 'TROUVER DES JOUEURS',
    searchPlaceholder: 'Rechercher par pseudo…',
    searchNoResults: (q: string) => `Aucun joueur trouvé pour "${q}".`,
    searchError: 'Recherche indisponible. Réessayer.',
    listHeader: (n: number) => `Tu suis · ${n}`,
    columnHeader: 'Score du jour',
    columnHeaderCompact: 'Score',
    statusOnline: 'En ligne',
    statusPlaying: 'En partie',
    statusFewMin: 'A joué il y a quelques minutes',
    statusHours: (n: number) => `A joué il y a ${n}h`,
    statusYesterday: 'A joué hier',
    statusDays: (n: number) => `A joué il y a ${n} jours`,
    statusNever: "N'a pas encore joué",
    cta: 'Défier',
    duelAuthError: 'Connectez-vous pour défier un ami',
    duelGenericError: 'Impossible de créer le duel. Réessayer.',
    emptyHeading: "Personne à suivre pour l'instant",
    emptyBody:
      "Recherchez un pseudo ci-dessus pour commencer à suivre d'autres joueurs.",
    loadingAria: 'Chargement des amis',
    listError: 'Impossible de charger vos amis. Réessayer.',
    retry: 'Réessayer',
    isFollowed: 'Suivi',
    followCta: 'Suivre',
    followAuthError: 'Connectez-vous pour suivre un joueur',
    followGenericError: 'Impossible de suivre. Réessayer.',
  },
  en: {
    title: 'Friends',
    searchLabel: 'FIND PLAYERS',
    searchPlaceholder: 'Search by username…',
    searchNoResults: (q: string) => `No player found for "${q}".`,
    searchError: 'Search unavailable. Retry.',
    listHeader: (n: number) => `Following · ${n}`,
    columnHeader: "Today's score",
    columnHeaderCompact: 'Score',
    statusOnline: 'Online',
    statusPlaying: 'Playing',
    statusFewMin: 'Played a few minutes ago',
    statusHours: (n: number) => `Played ${n}h ago`,
    statusYesterday: 'Played yesterday',
    statusDays: (n: number) => `Played ${n} days ago`,
    statusNever: "Hasn't played yet",
    cta: 'Challenge',
    duelAuthError: 'Sign in to challenge a friend',
    duelGenericError: "Couldn't create the duel. Retry.",
    emptyHeading: 'Nobody to follow yet',
    emptyBody: 'Search a username above to start following other players.',
    loadingAria: 'Loading friends',
    listError: "Couldn't load your friends. Retry.",
    retry: 'Retry',
    isFollowed: 'Following',
    followCta: 'Follow',
    followAuthError: 'Sign in to follow a player',
    followGenericError: "Couldn't follow. Retry.",
  },
}

function formatStatus(
  friend: Friend,
  t: (typeof COPY)['fr'] | (typeof COPY)['en']
): string {
  if (friend.status === 'online') return t.statusOnline
  if (friend.status === 'playing') return t.statusPlaying
  if (friend.status === 'never' || !friend.last_activity_at) return t.statusNever
  // last_played — compute delta
  const last = new Date(friend.last_activity_at).getTime()
  const now = Date.now()
  const minutes = Math.max(0, Math.floor((now - last) / 60000))
  if (minutes < 60) return t.statusFewMin
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t.statusHours(hours)
  const days = Math.floor(hours / 24)
  if (days === 1) return t.statusYesterday
  return t.statusDays(days)
}

export default function NewFriendsScreen({ lang }: { lang: 'fr' | 'en' }) {
  const isMobile = useIsMobile()
  const t = COPY[lang]
  const supabase = createSupabaseBrowserClient()
  const [username, setUsername] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchError, setSearchError] = useState(false)
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [friendsError, setFriendsError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastMsg>(null)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())

  // Resolve current user + username (Défier anon-guard input).
  // Anonymous users redirect to /auth/login (matches NewHistoryScreen + Legacy behavior).
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.href = '/auth/login'
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', data.user.id)
        .single()
      setUsername(profile?.username ?? data.user.email ?? null)
      setAuthReady(true)
    })
  }, [])

  async function loadFriends() {
    setLoading(true)
    setFriendsError(false)
    try {
      const res = await fetch('/api/friends')
      if (!res.ok) {
        // 401 (anon) → just empty list, no error banner.
        if (res.status === 401) {
          setFriends([])
          setLoading(false)
          return
        }
        setFriendsError(true)
        setLoading(false)
        return
      }
      const data = await res.json()
      setFriends(data.friends || [])
      setLoading(false)
    } catch {
      setFriendsError(true)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authReady) return
    loadFriends()
  }, [authReady])

  // Debounced search (inline setTimeout in useEffect — Q3 pattern).
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setSearchError(false)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/friends/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.results ?? [])
          setSearchError(false)
        } else if (res.status === 401) {
          // Anon search: show empty results + non-blocking toast hint, no error banner.
          setResults([])
          setSearchError(false)
        } else {
          setSearchError(true)
          setResults([])
        }
      } catch {
        setSearchError(true)
        setResults([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // Auto-hide toast.
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  async function handleFollow(userId: string) {
    if (!username) {
      setToast({ variant: 'error', message: t.followAuthError })
      return
    }
    if (followingIds.has(userId)) return
    setFollowingIds(prev => new Set(prev).add(userId))
    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followeeId: userId }),
      })
      if (res.ok) {
        // Optimistic UI: mark as followed in current results, refetch friends list.
        setResults(prev =>
          prev.map(r => (r.user_id === userId ? { ...r, is_followed: true } : r))
        )
        loadFriends()
      } else {
        setToast({ variant: 'error', message: t.followGenericError })
      }
    } catch {
      setToast({ variant: 'error', message: t.followGenericError })
    } finally {
      setFollowingIds(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  async function handleDefier() {
    if (!username) {
      setToast({ variant: 'error', message: t.duelAuthError })
      return
    }
    try {
      const res = await fetch('/api/duel/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.duelUrl) {
          window.location.href = data.duelUrl
          return
        }
        setToast({ variant: 'error', message: t.duelGenericError })
      } else {
        setToast({ variant: 'error', message: t.duelGenericError })
      }
    } catch {
      setToast({ variant: 'error', message: t.duelGenericError })
    }
  }

  const containerPadding = isMobile ? '4px 0 60px' : '32px 24px 80px'
  const showResults = query.length >= 2
  const replaceListWithResults = isMobile && showResults

  const sectionLabel = (text: string) => (
    <div
      style={{
        fontFamily: 'var(--wf-font-ui)',
        fontSize: isMobile ? 10 : 11,
        fontWeight: 600,
        letterSpacing: 1.4,
        color: 'var(--wf-muted)',
        marginBottom: 12,
      }}
    >
      {text}
    </div>
  )

  // Friend row renderer
  const renderFriendRow = (f: Friend, idx: number) => (
    <div
      key={f.user_id}
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '32px 1fr auto auto' : '38px 1fr auto auto',
        alignItems: 'center',
        gap: isMobile ? 10 : 14,
        padding: isMobile ? '10px 12px' : '14px 18px',
        borderTop: idx === 0 ? 'none' : '1px solid var(--wf-border)',
        fontFamily: 'var(--wf-font-ui)',
      }}
    >
      <div
        style={{
          width: isMobile ? 32 : 38,
          height: isMobile ? 32 : 38,
          borderRadius: '50%',
          background:
            'color-mix(in oklch, var(--wf-accent) 35%, var(--wf-bg2))',
          color: 'var(--wf-accent-ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: isMobile ? 13 : 15,
          textTransform: 'uppercase',
        }}
      >
        {f.avatar_initial}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: isMobile ? 13 : 14,
            fontWeight: 500,
            color: 'var(--wf-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {f.pseudonym}
        </div>
        <div
          style={{
            fontSize: isMobile ? 11 : 12,
            color: 'var(--wf-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {formatStatus(f, t)}
        </div>
      </div>
      <div
        style={{
          fontFamily: 'var(--wf-font-head)',
          fontSize: isMobile ? 13 : 15,
          fontWeight: 600,
          color: 'var(--wf-accent-text-on-light)',
          fontVariantNumeric: 'tabular-nums',
          textDecoration:
            f.today_score != null ? 'underline dotted transparent' : 'none',
        }}
      >
        {f.today_score != null ? f.today_score.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') : '—'}
      </div>
      <button
        onClick={handleDefier}
        style={{
          padding: '6px 14px',
          fontFamily: 'var(--wf-font-ui)',
          fontSize: isMobile ? 11 : 12,
          fontWeight: 500,
          color: 'var(--wf-muted)',
          background: 'transparent',
          border: '1px solid var(--wf-border-strong)',
          borderRadius: 'var(--wf-radius)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {t.cta}
      </button>
    </div>
  )

  // Search result row (no follow action; is_followed indicator only)
  const renderSearchResult = (r: SearchResult) => (
    <div
      key={r.user_id}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderTop: '1px solid var(--wf-border)',
        fontFamily: 'var(--wf-font-ui)',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background:
            'color-mix(in oklch, var(--wf-accent) 35%, var(--wf-bg2))',
          color: 'var(--wf-accent-ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 13,
          textTransform: 'uppercase',
        }}
      >
        {r.avatar_initial}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--wf-ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {r.pseudonym}
      </div>
      {r.is_followed ? (
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--wf-muted)',
            padding: '3px 10px',
            border: '1px solid var(--wf-border)',
            borderRadius: 999,
            background: 'var(--wf-bg2)',
          }}
        >
          {t.isFollowed}
        </span>
      ) : (
        <button
          onClick={() => handleFollow(r.user_id)}
          disabled={followingIds.has(r.user_id)}
          style={{
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--wf-font-ui)',
            color: 'var(--wf-accent-ink)',
            background: 'var(--wf-accent)',
            padding: '6px 14px',
            border: 'none',
            borderRadius: 999,
            cursor: followingIds.has(r.user_id) ? 'wait' : 'pointer',
            opacity: followingIds.has(r.user_id) ? 0.6 : 1,
          }}
        >
          {t.followCta}
        </button>
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--wf-bg)' }}>
      <NewDesignHeader lang={lang} />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: containerPadding }}>
        <h1
          style={{
            margin: '0 0 24px 0',
            fontFamily: 'var(--wf-font-head)',
            fontSize: isMobile ? 24 : 36,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--wf-ink)',
            lineHeight: 1.2,
            padding: isMobile ? '0 16px' : 0,
          }}
        >
          {t.title}
        </h1>

        {/* Search card */}
        <div
          style={{
            position: 'relative',
            background: 'var(--wf-surface)',
            border: '1px solid var(--wf-border)',
            borderRadius: 'var(--wf-radius-card)',
            padding: isMobile ? 14 : 20,
            marginBottom: 16,
          }}
        >
          {sectionLabel(t.searchLabel)}
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              color="var(--wf-muted)"
              style={{
                position: 'absolute',
                left: isMobile ? 12 : 14,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              style={{
                width: '100%',
                padding: isMobile ? '10px 12px 10px 36px' : '12px 14px 12px 40px',
                background: 'var(--wf-bg2)',
                border: '1.5px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius)',
                fontFamily: 'var(--wf-font-ui)',
                fontSize: isMobile ? 13 : 14,
                fontWeight: 500,
                color: 'var(--wf-ink)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--wf-accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--wf-border)')}
            />
          </div>

          {/* Desktop dropdown panel — absolute under input */}
          {!isMobile && showResults && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 6,
                background: 'var(--wf-surface)',
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius-card)',
                zIndex: 50,
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                overflow: 'hidden',
              }}
            >
              {searchError ? (
                <div
                  style={{
                    padding: '14px 18px',
                    fontFamily: 'var(--wf-font-ui)',
                    fontSize: 13,
                    color: 'var(--wf-muted)',
                  }}
                >
                  {t.searchError}
                </div>
              ) : results.length === 0 ? (
                <div
                  style={{
                    padding: '14px 18px',
                    fontFamily: 'var(--wf-font-ui)',
                    fontSize: 13,
                    color: 'var(--wf-muted)',
                  }}
                >
                  {t.searchNoResults(query)}
                </div>
              ) : (
                results.map(renderSearchResult)
              )}
            </div>
          )}
        </div>

        {/* Mobile: replace follow list with results panel when searching */}
        {replaceListWithResults ? (
          <div
            style={{
              background: 'var(--wf-surface)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius-card)',
              overflow: 'hidden',
            }}
          >
            {searchError ? (
              <div
                style={{
                  padding: '14px 16px',
                  fontFamily: 'var(--wf-font-ui)',
                  fontSize: 13,
                  color: 'var(--wf-muted)',
                }}
              >
                {t.searchError}
              </div>
            ) : results.length === 0 ? (
              <div
                style={{
                  padding: '14px 16px',
                  fontFamily: 'var(--wf-font-ui)',
                  fontSize: 13,
                  color: 'var(--wf-muted)',
                }}
              >
                {t.searchNoResults(query)}
              </div>
            ) : (
              results.map(renderSearchResult)
            )}
          </div>
        ) : (
          <FollowList
            loading={loading}
            error={friendsError}
            friends={friends}
            t={t}
            isMobile={isMobile}
            sectionLabel={sectionLabel}
            renderFriendRow={renderFriendRow}
            onRetry={loadFriends}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--wf-surface)',
            border: '1px solid var(--wf-border-strong)',
            borderRadius: 'var(--wf-radius)',
            padding: '10px 20px',
            fontFamily: 'var(--wf-font-ui)',
            fontSize: 13,
            color: toast.variant === 'error' ? '#ef4444' : 'var(--wf-ink)',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxWidth: 'calc(100vw - 40px)',
            textAlign: 'center',
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

// Follow list child (kept inline; presentational)
function FollowList(props: {
  loading: boolean
  error: boolean
  friends: Friend[] | null
  t: (typeof COPY)['fr'] | (typeof COPY)['en']
  isMobile: boolean
  sectionLabel: (text: string) => React.ReactElement
  renderFriendRow: (f: Friend, idx: number) => React.ReactElement
  onRetry: () => void
}) {
  const { loading, error, friends, t, isMobile, sectionLabel, renderFriendRow, onRetry } = props

  if (loading) {
    return (
      <div
        aria-label={t.loadingAria}
        style={{
          background: 'var(--wf-surface)',
          border: '1px solid var(--wf-border)',
          borderRadius: 'var(--wf-radius-card)',
          padding: isMobile ? 14 : 20,
        }}
      >
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr',
              gap: 12,
              alignItems: 'center',
              padding: '10px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--wf-border)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--wf-bg2)',
              }}
            />
            <div>
              <div
                style={{
                  height: 12,
                  background: 'var(--wf-bg2)',
                  borderRadius: 4,
                  width: '40%',
                  marginBottom: 6,
                }}
              />
              <div
                style={{
                  height: 10,
                  background: 'var(--wf-bg2)',
                  borderRadius: 4,
                  width: '60%',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    // Phase 13 / Plan 04 (D-10): shared NewErrorState in headerless mode
    // (parent NewFriendsScreen already mounts NewDesignHeader). Replaces
    // the inline retry-button card.
    return <NewErrorState lang={t === COPY.fr ? 'fr' : 'en'} headerless message={t.listError} onRetry={onRetry} />
  }

  const list = friends ?? []
  if (list.length === 0) {
    return (
      <div
        style={{
          padding: isMobile ? '32px 16px' : '48px 24px',
          textAlign: 'center',
          fontFamily: 'var(--wf-font-ui)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--wf-font-head)',
            fontSize: isMobile ? 17 : 20,
            fontWeight: 600,
            color: 'var(--wf-ink)',
            margin: '0 0 8px 0',
          }}
        >
          {t.emptyHeading}
        </h2>
        <p style={{ color: 'var(--wf-muted)', fontSize: 14, margin: 0 }}>
          {t.emptyBody}
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--wf-surface)',
        border: '1px solid var(--wf-border)',
        borderRadius: 'var(--wf-radius-card)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isMobile ? '12px 14px 8px' : '16px 20px 10px',
        }}
      >
        {sectionLabel(t.listHeader(list.length))}
        <div
          style={{
            fontFamily: 'var(--wf-font-ui)',
            fontSize: isMobile ? 10 : 11,
            fontWeight: 600,
            letterSpacing: 1.4,
            color: 'var(--wf-muted)',
            marginBottom: 12,
          }}
        >
          {isMobile ? t.columnHeaderCompact : t.columnHeader}
        </div>
      </div>
      {list.map(renderFriendRow)}
    </div>
  )
}
