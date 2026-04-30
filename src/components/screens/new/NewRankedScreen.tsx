'use client'

/**
 * NewRankedScreen — Phase 11 SCR-05 / D-01.
 *
 * D-01 ranked shell: matches the Leaderboard ranked-tab visual vocabulary.
 * Reuses the shared RankedRow primitive (Pitfall 7) so this view and the
 * Leaderboard ranked tab share medal/avatar/VOUS/accent-points chrome.
 *
 * Scope firewall: this is a visual rebuild. The legacy ranked play-session
 * (LegacyRankedScreen) handles the actual ranked-game state machine; users
 * still play ranked there. This screen surfaces the global ranked
 * leaderboard so the new-design /ranked route has a meaningful new-chrome
 * landing under flag-on. Future phase (post-v1.1) will rebuild the ranked
 * play UX in new design.
 *
 * Tokens: var(--wf-*) only. All numbers tabular-nums.
 */

import { useEffect, useState } from 'react'
import NewDesignHeader from '@/components/game/new/NewDesignHeader'
import RankedRow from './RankedRow'
import { calculateScore, useIsMobile } from '@/lib/utils'
import { createSupabaseBrowserClient } from '@/lib/supabase'

type GlobalEntry = {
  username: string
  score?: number
  guess_count?: number
  duration_seconds?: number
  position: number
}

type Lang = 'fr' | 'en'

const TRANSLATIONS = {
  fr: {
    title: 'Classé',
    subtitle: 'Top 10 mondial',
    columnHash: '#',
    columnPlayer: 'Joueur',
    columnPoints: 'Points',
    selfBadge: 'VOUS',
    empty: 'Aucun résultat pour l\u2019instant.',
    loading: 'Chargement…',
  },
  en: {
    title: 'Ranked',
    subtitle: 'Global top 10',
    columnHash: '#',
    columnPlayer: 'Player',
    columnPoints: 'Points',
    selfBadge: 'YOU',
    empty: 'No results yet.',
    loading: 'Loading\u2026',
  },
} as const

type Props = { lang?: Lang }

export default function NewRankedScreen({ lang = 'fr' }: Props) {
  const isMobile = useIsMobile()
  const t = TRANSLATIONS[lang]
  const [rows, setRows] = useState<GlobalEntry[] | null>(null)
  const [selfUsername, setSelfUsername] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }) => {
      const meta = (data.user?.user_metadata ?? {}) as { username?: string }
      if (meta?.username) setSelfUsername(meta.username)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/leaderboard?type=global')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        const list = Array.isArray(j) ? j : Array.isArray(j?.entries) ? j.entries : []
        setRows(list.slice(0, 10))
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const containerStyle: React.CSSProperties = {
    maxWidth: 860,
    margin: '0 auto',
    padding: isMobile ? '12px 16px 32px' : '24px 24px 48px',
    fontFamily: 'var(--wf-font-ui)',
    color: 'var(--wf-ink)',
  }

  return (
    <>
      <NewDesignHeader lang={lang} />
      <main style={containerStyle}>
        <h1
          style={{
            fontFamily: 'var(--wf-font-head)',
            fontSize: isMobile ? 24 : 36,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            margin: '8px 0 4px',
            color: 'var(--wf-ink)',
          }}
        >
          {t.title}
        </h1>
        <div
          style={{
            fontSize: 12,
            color: 'var(--wf-muted)',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            marginBottom: 20,
          }}
        >
          {t.subtitle}
        </div>

        <div
          style={{
            background: 'var(--wf-surface)',
            border: '1px solid var(--wf-border)',
            borderRadius: 'var(--wf-radiusCard)',
            padding: 6,
          }}
        >
          {!isMobile && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 90px',
                padding: '8px 18px',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1.2,
                color: 'var(--wf-muted)',
              }}
            >
              <span>{t.columnHash}</span>
              <span>{t.columnPlayer}</span>
              <span style={{ textAlign: 'right' }}>{t.columnPoints}</span>
            </div>
          )}

          {rows === null ? (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 44,
                    background: 'var(--wf-bg2)',
                    borderRadius: 'var(--wf-radiusCard)',
                  }}
                />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                color: 'var(--wf-muted)',
                fontSize: 13,
              }}
            >
              {t.empty}
            </div>
          ) : (
            rows.map((e, i) => {
              const rank = i + 1
              const isSelf = !!selfUsername && e.username === selfUsername
              const pts = e.score ?? calculateScore(e.guess_count ?? 0, true)
              return (
                <RankedRow
                  key={`${e.username}-${rank}`}
                  rank={rank}
                  username={e.username}
                  points={pts}
                  isSelf={isSelf}
                  selfLabel={t.selfBadge}
                />
              )
            })
          )}
        </div>
      </main>
    </>
  )
}
