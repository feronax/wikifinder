'use client'

/**
 * NewHistoryScreen — Phase 11 SCR-01.
 *
 * 30-day heatmap + reverse-chronological run list. Consumes GET /api/history
 * verbatim. Tokens: `--wf-*` only. All numbers tabular-nums. Light-theme
 * contrast lock: "{pts} pts" meta is rendered at 13/600 (bumped from 12/600
 * per UI-SPEC §Color contrast caveat) — picks the size-bump option vs.
 * underline-dotted for visual cleanliness in row meta.
 */

import { useEffect, useState } from 'react'
import { calculateScore, useIsMobile } from '@/lib/utils'
import NewDesignHeader from '@/components/game/new/NewDesignHeader'
import NewSkeleton from '@/components/screens/new/NewSkeleton'
import NewErrorState from '@/components/screens/new/NewErrorState'
import { createSupabaseBrowserClient } from '@/lib/supabase'

type HistoryEntry = {
  page_id: string
  date: string
  wikipedia_title_fr: string
  wikipedia_title_en: string
  game: {
    id: string
    lang: string
    guess_count: number
    completed: boolean
  } | null
}

type CellState = 'empty' | 'playing' | 'won'

const COPY = {
  fr: {
    title: 'Historique',
    heatmapLabel: '30 DERNIERS JOURS',
    won: 'Revoir',
    playing: 'Reprendre',
    empty: 'Jouer',
    tries: (n: number) => `${n} tentative${n > 1 ? 's' : ''}`,
    pts: (n: number) => `${n.toLocaleString('fr-FR')} pts`,
    inProgress: 'En cours…',
    notStarted: 'Non commencée',
    emptyHeading: 'Aucune partie encore',
    emptyBody: "Jouez la partie d'aujourd'hui pour démarrer votre historique.",
    emptyCta: "Jouer aujourd'hui",
    error: 'Impossible de charger votre historique. Réessayer.',
    retry: 'Réessayer',
  },
  en: {
    title: 'History',
    heatmapLabel: 'LAST 30 DAYS',
    won: 'Review',
    playing: 'Resume',
    empty: 'Play',
    tries: (n: number) => `${n} tries`,
    pts: (n: number) => `${n.toLocaleString('en-US')} pts`,
    inProgress: 'In progress…',
    notStarted: 'Not started',
    emptyHeading: 'No games yet',
    emptyBody: "Play today's game to start your history.",
    emptyCta: 'Play today',
    error: "Couldn't load your history. Retry.",
    retry: 'Retry',
  },
}

function isoDay(offset: number): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().split('T')[0]
}

export default function NewHistoryScreen({ lang }: { lang: 'fr' | 'en' }) {
  const isMobile = useIsMobile()
  const t = COPY[lang]
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function load() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/history?page=1')
      if (!res.ok) {
        setError(true)
        setLoading(false)
        return
      }
      const data = await res.json()
      setHistory(data.history || [])
      setLoading(false)
    } catch {
      setError(true)
      setLoading(false)
    }
  }

  // Anonymous-user guard: redirect to login (matches LegacyHistoryScreen behavior).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = '/auth/login'
        return
      }
      load()
    })
  }, [])

  const containerPadding = isMobile ? '4px 0 60px' : '32px 24px 80px'

  // Phase 13 / Plan 04 (D-10): shared primitives replace inline skeleton +
  // error blocks (3-row placeholder + retry button were duplicates of the
  // shared <NewSkeleton> / <NewErrorState> components).
  if (loading) {
    return <NewSkeleton lang={lang} blocks={[72, 72, 72]} />
  }

  if (error) {
    return <NewErrorState lang={lang} message={t.error} onRetry={load} />
  }

  // Build 30-day heatmap window (today, today-1, …, today-29).
  const days30 = Array.from({ length: 30 }, (_, i) => isoDay(29 - i))
  const byDate = new Map<string, HistoryEntry>()
  for (const e of history || []) byDate.set(e.date, e)

  const heatmap = days30.map(date => {
    const entry = byDate.get(date)
    let state: CellState = 'empty'
    let intensity = 0
    if (entry?.game) {
      if (entry.game.completed) {
        state = 'won'
        const score = calculateScore(entry.game.guess_count, true)
        // Map 0..5000 → 0.5..1.0 opacity.
        intensity = 0.5 + Math.min(1, score / 5000) * 0.5
      } else {
        state = 'playing'
      }
    }
    return { date, state, intensity, entry }
  })

  const sortedRuns = [...(history || [])].sort((a, b) => (a.date < b.date ? 1 : -1))
  const isEmptyState = sortedRuns.length === 0

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

        {isEmptyState ? (
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
            <p style={{ color: 'var(--wf-muted)', fontSize: 14, margin: '0 0 24px 0' }}>
              {t.emptyBody}
            </p>
            <a
              href={`/game?lang=${lang}`}
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--wf-accent-ink)',
                background: 'var(--wf-accent)',
                borderRadius: 'var(--wf-radius)',
                textDecoration: 'none',
              }}
            >
              {t.emptyCta}
            </a>
          </div>
        ) : (
          <>
            {/* Heatmap card */}
            <div
              style={{
                background: 'var(--wf-surface)',
                border: '1px solid var(--wf-border)',
                borderRadius: 'var(--wf-radius-card)',
                padding: isMobile ? 14 : 20,
                marginBottom: isMobile ? 16 : 24,
              }}
            >
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
                {t.heatmapLabel}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(30, 1fr)',
                  gap: isMobile ? 2 : 4,
                }}
              >
                {heatmap.map(cell => (
                  <div
                    key={cell.date}
                    title={cell.date}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 3,
                      background:
                        cell.state === 'won' ? 'var(--wf-accent)' : 'transparent',
                      opacity: cell.state === 'won' ? cell.intensity : 1,
                      border:
                        cell.state === 'empty'
                          ? '1px solid var(--wf-border)'
                          : cell.state === 'playing'
                            ? '1px solid var(--wf-border-strong)'
                            : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Run list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
              {sortedRuns.map(entry => {
                const title =
                  lang === 'fr' ? entry.wikipedia_title_fr : entry.wikipedia_title_en
                const game = entry.game
                const completed = !!game?.completed
                const playing = !!game && !completed
                const empty = !game
                const score = game ? calculateScore(game.guess_count, completed) : 0
                const cta = completed ? t.won : playing ? t.playing : t.empty
                const ctaFilled = !completed
                const url = `/game?date=${entry.date}&lang=${lang}`

                return (
                  <a
                    key={entry.page_id}
                    href={url}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'center',
                      gap: 12,
                      padding: isMobile ? '10px 12px' : '14px 18px',
                      borderRadius: 'var(--wf-radius-card)',
                      background: 'var(--wf-surface)',
                      border: '1px solid var(--wf-border)',
                      borderLeft: completed
                        ? '3px solid var(--wf-accent)'
                        : '1px solid var(--wf-border)',
                      textDecoration: 'none',
                      opacity: empty ? 0.55 : 1,
                      fontFamily: 'var(--wf-font-ui)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: isMobile ? 10 : 11,
                          fontWeight: 600,
                          letterSpacing: 1.2,
                          color: 'var(--wf-muted)',
                          marginBottom: 4,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {entry.date}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--wf-font-head)',
                          fontSize: isMobile ? 14 : 17,
                          fontWeight: 600,
                          color: 'var(--wf-ink)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {completed ? title : null}
                        {playing && (
                          <span
                            style={{
                              fontStyle: 'italic',
                              color: 'var(--wf-muted)',
                              fontWeight: 500,
                            }}
                          >
                            {t.inProgress}
                          </span>
                        )}
                        {empty && (
                          <span
                            style={{
                              fontStyle: 'italic',
                              color: 'var(--wf-faint)',
                              fontWeight: 500,
                            }}
                          >
                            {t.notStarted}
                          </span>
                        )}
                      </div>
                      {game && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: isMobile ? 11 : 12,
                            color: 'var(--wf-muted)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {t.tries(game.guess_count)}
                          {completed && (
                            <>
                              <span aria-hidden> · </span>
                              <span
                                style={{
                                  color: 'var(--wf-accent-text-on-light)',
                                  fontWeight: 700,
                                  fontSize: 13,
                                }}
                              >
                                {t.pts(score)}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        padding: isMobile ? '6px 12px' : '8px 16px',
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 500,
                        borderRadius: 'var(--wf-radius)',
                        background: ctaFilled ? 'var(--wf-accent)' : 'transparent',
                        color: ctaFilled ? 'var(--wf-accent-ink)' : 'var(--wf-muted)',
                        border: ctaFilled
                          ? '1px solid var(--wf-accent)'
                          : '1px solid var(--wf-border-strong)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cta}
                    </span>
                  </a>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
