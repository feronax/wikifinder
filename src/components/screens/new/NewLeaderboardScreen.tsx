'use client'

/**
 * NewLeaderboardScreen — Phase 11 SCR-02.
 *
 * 3 segmented tabs (Aujourd'hui / Classé / Survival) + podium top-3 +
 * ranked list. Consumes GET /api/leaderboard verbatim. Tokens: `--wf-*`
 * only. All numbers tabular-nums. Ranked-tab rows use the shared
 * RankedRow primitive (Pitfall 7) for medal/avatar/VOUS/accent points
 * parity with NewRankedScreen (Plan 09).
 *
 * API translation: page tab `daily|ranked|survival` → API `type=daily|global|survival`
 * (matches LegacyLeaderboardScreen MODE_TO_TYPE convention).
 */

import { useEffect, useRef, useState } from 'react'
import { calculateScore, useIsMobile } from '@/lib/utils'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import NewDesignHeader from '@/components/game/new/NewDesignHeader'
import NewSkeleton from '@/components/screens/new/NewSkeleton'
import NewErrorState from '@/components/screens/new/NewErrorState'
import RankedRow from './RankedRow'

type Tab = 'daily' | 'ranked' | 'survival'

type DailyEntry = {
  username: string
  score?: number
  guess_count: number
  duration_seconds: number
  date: string
  position: number
  lang: string
}

type GlobalEntry = {
  username: string
  score: number
  guess_count: number
  duration_seconds: number
  position: number
}

type SurvivalEntry = {
  username: string
  score: number
  completed_at: string
  lang: string
  chain_length: number
  position: number
}

const TAB_TO_TYPE: Record<Tab, 'daily' | 'global' | 'survival'> = {
  daily: 'daily',
  ranked: 'global',
  survival: 'survival',
}

const COPY = {
  fr: {
    title: 'Classement',
    subtitle: (date: string) => `Meilleurs scores du ${date} · mise à jour à minuit`,
    tabs: { daily: "Aujourd'hui", ranked: 'Classé', survival: 'Survival' },
    selfBadge: 'VOUS',
    headers: {
      hash: '#',
      player: 'JOUEUR',
      tries: 'ESSAIS',
      time: 'TEMPS',
      lang: 'LANGUE',
      points: 'POINTS',
      streak: 'SÉRIE',
    },
    metaDaily: (tries: number, secs: number) =>
      `${tries} essais · ${formatDuration(secs)}`,
    metaPoints: (n: number) => `${n.toLocaleString('fr-FR')} pts`,
    metaStreak: (n: number) => `série de ${n}`,
    empty: "Pas encore de scores pour ce mode aujourd'hui.",
    error: 'Impossible de charger le classement. Réessayer.',
    retry: 'Réessayer',
  },
  en: {
    title: 'Leaderboard',
    subtitle: (date: string) => `Top scores for ${date} · updated at midnight`,
    tabs: { daily: 'Today', ranked: 'Ranked', survival: 'Survival' },
    selfBadge: 'YOU',
    headers: {
      hash: '#',
      player: 'PLAYER',
      tries: 'TRIES',
      time: 'TIME',
      lang: 'LANGUAGE',
      points: 'POINTS',
      streak: 'STREAK',
    },
    metaDaily: (tries: number, secs: number) =>
      `${tries} tries · ${formatDuration(secs)}`,
    metaPoints: (n: number) => `${n.toLocaleString('en-US')} pts`,
    metaStreak: (n: number) => `streak of ${n}`,
    empty: 'No scores for this mode yet today.',
    error: "Couldn't load the leaderboard. Retry.",
    retry: 'Retry',
  },
}

function formatDuration(secs: number): string {
  if (!secs || secs < 0) return '—'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function NewLeaderboardScreen({ lang }: { lang: 'fr' | 'en' }) {
  const isMobile = useIsMobile()
  const t = COPY[lang]
  const [tab, setTab] = useState<Tab>('daily')
  const [cache, setCache] = useState<Partial<Record<Tab, any[]>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selfUsername, setSelfUsername] = useState<string | null>(null)
  const selfRowRef = useRef<HTMLDivElement | null>(null)
  const containerPadding = isMobile ? '4px 0 60px' : '32px 24px 80px'
  const today = new Date().toISOString().split('T')[0]
  const supabase = createSupabaseBrowserClient()

  // Resolve self pseudonym for VOUS detection.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', data.user.id)
        .single()
      if (profile?.username) setSelfUsername(profile.username)
    })
  }, [])

  async function load(which: Tab) {
    if (cache[which]) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    try {
      const type = TAB_TO_TYPE[which]
      const res = await fetch(`/api/leaderboard?type=${type}`)
      if (!res.ok) {
        setError(true)
        setLoading(false)
        return
      }
      const data = await res.json()
      setCache(prev => ({ ...prev, [which]: data.leaderboard || [] }))
      setLoading(false)
    } catch {
      setError(true)
      setLoading(false)
    }
  }

  useEffect(() => {
    load(tab)
  }, [tab])

  // Scroll self row into view on data load.
  useEffect(() => {
    if (loading || error) return
    const node = selfRowRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight
    if (!inView) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [loading, tab, cache])

  const rows = cache[tab] || []

  // Phase 13 / Plan 04 (D-10): shared NewErrorState replaces the inline
  // error block. POL-04: shared error aesthetic across all new screens.
  if (error) {
    return <NewErrorState lang={lang} message={t.error} onRetry={() => load(tab)} />
  }

  // Top-3 for podium.
  const top3 = rows.slice(0, 3)
  const restStart = top3.length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--wf-bg)' }}>
      <NewDesignHeader lang={lang} />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: containerPadding }}>
        <h1
          style={{
            margin: '0 0 8px 0',
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
        <p
          style={{
            margin: '0 0 20px 0',
            fontFamily: 'var(--wf-font-ui)',
            fontSize: isMobile ? 11.5 : 13,
            color: 'var(--wf-muted)',
            padding: isMobile ? '0 16px' : 0,
          }}
        >
          {t.subtitle(today)}
        </p>

        {/* Segmented tabs */}
        <div
          style={{
            display: 'inline-flex',
            padding: 4,
            background: 'var(--wf-bg2)',
            border: '1px solid var(--wf-border)',
            borderRadius: 'var(--wf-radius)',
            marginBottom: 24,
            marginLeft: isMobile ? 16 : 0,
            fontFamily: 'var(--wf-font-ui)',
          }}
        >
          {(['daily', 'ranked', 'survival'] as Tab[]).map(k => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                padding: '6px 14px',
                fontSize: isMobile ? 12 : 13,
                fontWeight: 500,
                color: tab === k ? 'var(--wf-accent-ink)' : 'var(--wf-muted)',
                background: tab === k ? 'var(--wf-accent)' : 'transparent',
                border: 'none',
                borderRadius: 'calc(var(--wf-radius) - 2px)',
                cursor: 'pointer',
                transition: 'background 150ms linear',
              }}
            >
              {t.tabs[k]}
            </button>
          ))}
        </div>

        {loading ? (
          <div>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  width: '100%',
                  height: 56,
                  background: 'var(--wf-bg2)',
                  borderRadius: 'var(--wf-radius-card)',
                  marginBottom: 8,
                }}
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--wf-muted)',
              fontFamily: 'var(--wf-font-ui)',
              fontSize: 14,
            }}
          >
            {t.empty}
          </p>
        ) : (
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.1fr 1fr',
                  alignItems: 'end',
                  gap: isMobile ? 8 : 12,
                  marginBottom: isMobile ? 16 : 24,
                  padding: isMobile ? '0 16px' : 0,
                }}
              >
                {[1, 0, 2].map(idx => {
                  const e: any = top3[idx]
                  if (!e) return <div key={idx} />
                  const heights = isMobile ? [108, 86, 80] : [140, 110, 100]
                  // Render order: idx=1 → place 2 (left, height[1]), idx=0 → place 1 (center, height[0]), idx=2 → place 3 (right, height[2])
                  const heightMap = isMobile
                    ? { 0: 108, 1: 86, 2: 80 }
                    : { 0: 140, 1: 110, 2: 100 }
                  const height = (heightMap as Record<number, number>)[idx]
                  const rank = idx + 1
                  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
                  const isSelf = !!selfUsername && e.username === selfUsername

                  let metaLine = ''
                  if (tab === 'daily') {
                    metaLine = t.metaDaily(
                      e.guess_count ?? 0,
                      e.duration_seconds ?? 0
                    )
                  } else if (tab === 'ranked') {
                    const pts =
                      e.score ?? calculateScore(e.guess_count ?? 0, true)
                    metaLine = t.metaPoints(pts)
                  } else {
                    metaLine = t.metaStreak(e.chain_length ?? 0)
                  }

                  return (
                    <div
                      key={idx}
                      style={{
                        height,
                        background: isSelf
                          ? 'color-mix(in oklch, var(--wf-accent) 14%, var(--wf-surface))'
                          : 'var(--wf-surface)',
                        border: isSelf
                          ? '1px solid var(--wf-accent)'
                          : '1px solid var(--wf-border)',
                        borderRadius: 'var(--wf-radius-card)',
                        padding: isMobile ? 10 : 14,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        textAlign: 'center',
                        fontFamily: 'var(--wf-font-ui)',
                      }}
                    >
                      <div style={{ fontSize: isMobile ? 18 : 22, lineHeight: 1 }}>
                        {medal}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: isMobile ? 13 : 16,
                          fontWeight: 600,
                          color: 'var(--wf-ink)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                          fontFamily: 'var(--wf-font-head)',
                        }}
                      >
                        {e.username}
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: isMobile ? 10 : 11,
                          color: 'var(--wf-muted)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {metaLine}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Ranked list */}
            <div
              style={{
                background: 'var(--wf-surface)',
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius-card)',
                padding: 6,
                margin: isMobile ? '0 16px' : 0,
                fontFamily: 'var(--wf-font-ui)',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile
                    ? '28px 1fr auto'
                    : tab === 'daily'
                      ? '50px 1fr 90px 90px 60px'
                      : '50px 1fr 90px',
                  padding: isMobile ? '6px 12px' : '8px 18px',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 1.2,
                  color: 'var(--wf-muted)',
                }}
              >
                <span>{t.headers.hash}</span>
                <span>{t.headers.player}</span>
                {tab === 'daily' ? (
                  isMobile ? (
                    <span style={{ textAlign: 'right' }}>
                      {t.headers.tries} · {t.headers.time}
                    </span>
                  ) : (
                    <>
                      <span style={{ textAlign: 'right' }}>{t.headers.tries}</span>
                      <span style={{ textAlign: 'right' }}>{t.headers.time}</span>
                      <span style={{ textAlign: 'right' }}>{t.headers.lang}</span>
                    </>
                  )
                ) : tab === 'ranked' ? (
                  <span style={{ textAlign: 'right' }}>{t.headers.points}</span>
                ) : (
                  <span style={{ textAlign: 'right' }}>{t.headers.streak}</span>
                )}
              </div>

              {rows.slice(restStart).map((e: any, i: number) => {
                const rank = restStart + i + 1
                const isSelf = !!selfUsername && e.username === selfUsername
                const refProp = isSelf ? { ref: selfRowRef } : {}

                if (tab === 'ranked') {
                  const pts =
                    e.score ?? calculateScore(e.guess_count ?? 0, true)
                  return (
                    <div key={`${e.username}-${rank}`} {...(refProp as any)}>
                      <RankedRow
                        rank={rank}
                        username={e.username}
                        points={pts}
                        isSelf={isSelf}
                        selfLabel={t.selfBadge}
                      />
                    </div>
                  )
                }

                // Daily / Survival inline rows (not RankedRow — different cols).
                const gridCols = isMobile
                  ? '28px 1fr auto'
                  : tab === 'daily'
                    ? '50px 1fr 90px 90px 60px'
                    : '50px 1fr 90px'
                const padding = isMobile ? '10px 12px' : '14px 18px'
                const isMedal = rank <= 3
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
                const avatarInitial = (e.username[0] ?? '?').toUpperCase()

                return (
                  <div
                    key={`${e.username}-${rank}`}
                    {...(refProp as any)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: gridCols,
                      alignItems: 'center',
                      padding,
                      borderTop: '1px solid var(--wf-border)',
                      borderLeft: isSelf
                        ? '3px solid var(--wf-accent)'
                        : '3px solid transparent',
                      background: isSelf
                        ? 'color-mix(in oklch, var(--wf-accent) 10%, var(--wf-surface))'
                        : 'transparent',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: isMedal ? 700 : 500,
                        color: isMedal ? 'var(--wf-accent)' : 'var(--wf-muted)',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: isMobile ? 12 : 13,
                      }}
                    >
                      {medal ?? rank}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        minWidth: 0,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: isMobile ? 22 : 26,
                          height: isMobile ? 22 : 26,
                          borderRadius: '50%',
                          background: 'var(--wf-bg2)',
                          border: '1px solid var(--wf-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: isMobile ? 10 : 11,
                          fontWeight: 600,
                          color: 'var(--wf-muted)',
                          flexShrink: 0,
                        }}
                      >
                        {avatarInitial}
                      </span>
                      <span
                        style={{
                          fontSize: isMobile ? 13 : 14,
                          fontWeight: 500,
                          color: 'var(--wf-ink)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {e.username}
                      </span>
                      {isSelf && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: 1,
                            color: 'var(--wf-accent-text-on-light)',
                            textDecoration: 'underline dotted',
                            textUnderlineOffset: 2,
                            flexShrink: 0,
                          }}
                        >
                          {t.selfBadge}
                        </span>
                      )}
                    </span>
                    {tab === 'daily' ? (
                      isMobile ? (
                        <span
                          style={{
                            textAlign: 'right',
                            fontSize: 12,
                            color: 'var(--wf-muted)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {e.guess_count} · {formatDuration(e.duration_seconds ?? 0)}
                        </span>
                      ) : (
                        <>
                          <span
                            style={{
                              textAlign: 'right',
                              fontSize: 13,
                              color: 'var(--wf-ink)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {e.guess_count}
                          </span>
                          <span
                            style={{
                              textAlign: 'right',
                              fontSize: 13,
                              color: 'var(--wf-ink)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {formatDuration(e.duration_seconds ?? 0)}
                          </span>
                          <span
                            style={{
                              textAlign: 'right',
                              fontSize: 12,
                              color: 'var(--wf-muted)',
                              textTransform: 'uppercase',
                            }}
                          >
                            {e.lang}
                          </span>
                        </>
                      )
                    ) : (
                      // Survival: streak with 🔥
                      <span
                        style={{
                          textAlign: 'right',
                          fontFamily: 'var(--wf-font-head)',
                          fontWeight: 600,
                          fontSize: isMobile ? 13 : 15,
                          color: 'var(--wf-accent-text-on-light)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        🔥 {(e.chain_length ?? 0).toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
