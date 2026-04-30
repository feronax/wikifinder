'use client'

/**
 * NewProfileScreen — Phase 11 SCR-03.
 *
 * Identity card + 4×2 stats grid + Série/Rappel dual cards + Preferences.
 * Consumes existing /api/stats + /api/badges + Supabase profiles SELECT.
 * Tokens: --wf-* only. All numbers tabular-nums. FR + EN copy per UI-SPEC §Profile.
 *
 * Éditer CTA (D-07): shows a 3000ms toast "Édition du pseudo bientôt
 * disponible" / "Username editing coming soon"; no PATCH call (T-11-28).
 *
 * Preferences card wraps the existing wikifinder/src/app/profile/Preferences
 * component verbatim (D-Discretion: token mismatch documented in SUMMARY —
 * Phase 12 owns the rebuild of Preferences chrome).
 */

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useIsMobile } from '@/lib/utils'
import NewDesignHeader from '@/components/game/new/NewDesignHeader'
import Preferences from '@/app/profile/Preferences'

type ModeStats = {
  totalGames: number
  totalWins: number
  winRate: number
  avgGuesses: number
  bestScore: number
  avgScore: number
  distribution: Record<string, number>
  avgDurationSeconds?: number
  avgTime?: number
}

type Stats = {
  daily: ModeStats & { streak: number; bestStreak: number }
  ranked: ModeStats
}

type Badge = {
  key: string
  icon: string
  name: string
  unlocked?: boolean
}

const COPY = {
  fr: {
    title: 'Mon profil',
    metaDesktop: (date: string, rank: number | null) =>
      rank != null
        ? `Membre depuis le ${date} · rang #${rank} mondial`
        : `Membre depuis le ${date}`,
    metaCompact: (rank: number | null) =>
      rank != null ? `Rang #${rank} mondial` : 'Rang non classé',
    edit: 'Éditer',
    editToast: 'Édition du pseudo bientôt disponible',
    statsLabel: 'STATISTIQUES',
    stat1: 'Parties jouées',
    stat2: 'Taux de victoire',
    stat3: 'Essais moy.',
    stat4: 'Meilleur score',
    stat5: 'Score moyen',
    stat6: 'Victoires',
    stat7: 'Temps moyen',
    stat8: 'Meilleur streak',
    serieLabel: 'SÉRIE',
    serieCaption: 'Jouez tous les jours pour augmenter votre série',
    serieCaptionCompact: 'Jouez chaque jour',
    rappelLabel: 'RAPPEL',
    rappelDesktop: 'Notification à 18h30',
    rappelCompact: '18h30',
    prefsLabel: 'PRÉFÉRENCES',
  },
  en: {
    title: 'My profile',
    metaDesktop: (date: string, rank: number | null) =>
      rank != null
        ? `Member since ${date} · rank #${rank} worldwide`
        : `Member since ${date}`,
    metaCompact: (rank: number | null) =>
      rank != null ? `Rank #${rank} worldwide` : 'Unranked',
    edit: 'Edit',
    editToast: 'Username editing coming soon',
    statsLabel: 'STATS',
    stat1: 'Games played',
    stat2: 'Win rate',
    stat3: 'Avg. tries',
    stat4: 'Best score',
    stat5: 'Avg. score',
    stat6: 'Wins',
    stat7: 'Avg. time',
    stat8: 'Best streak',
    serieLabel: 'STREAK',
    serieCaption: 'Play every day to grow your streak',
    serieCaptionCompact: 'Play daily',
    rappelLabel: 'REMINDER',
    rappelDesktop: 'Notification at 6:30pm',
    rappelCompact: '6:30pm',
    prefsLabel: 'PREFERENCES',
  },
}

function formatDuration(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const mm = Math.floor(seconds / 60)
  const ss = Math.floor(seconds % 60)
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

export default function NewProfileScreen({ lang }: { lang: 'fr' | 'en' }) {
  const isMobile = useIsMobile()
  const t = COPY[lang]
  const [user, setUser] = useState<{ id: string; email?: string; created_at?: string } | null>(null)
  const [username, setUsername] = useState<string>('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [editToast, setEditToast] = useState(false)
  const [reminderOn, setReminderOn] = useState(false)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.href = '/auth/login'
        return
      }
      setUser({ id: data.user.id, email: data.user.email, created_at: data.user.created_at })
      const [profileRes, statsData, badgesData] = await Promise.all([
        supabase
          .from('profiles')
          .select('username, favorite_badge')
          .eq('id', data.user.id)
          .single(),
        fetch('/api/stats')
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(`/api/badges?userId=${data.user.id}`)
          .then(r => (r.ok ? r.json() : { badges: [] }))
          .catch(() => ({ badges: [] })),
      ])
      if (profileRes.data?.username) setUsername(profileRes.data.username)
      if (statsData && statsData.daily && statsData.ranked) setStats(statsData)
      if (badgesData?.badges) setBadges(badgesData.badges.filter((b: Badge) => b.unlocked))
      setLoading(false)
    })
  }, [])

  function handleEditClick() {
    setEditToast(true)
    setTimeout(() => setEditToast(false), 3000)
  }

  const containerPadding = isMobile ? '4px 0 60px' : '32px 24px 80px'

  // Functional skeleton (D-09).
  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--wf-bg)' }}>
        <NewDesignHeader lang={lang} />
        <div style={{ maxWidth: 760, margin: '0 auto', padding: containerPadding }}>
          <div
            style={{
              width: 180,
              height: isMobile ? 24 : 36,
              background: 'var(--wf-bg2)',
              borderRadius: 'var(--wf-radius)',
              marginBottom: 24,
              marginLeft: isMobile ? 16 : 0,
            }}
          />
          {[100, 220, 140].map((h, i) => (
            <div
              key={i}
              style={{
                width: '100%',
                height: h,
                background: 'var(--wf-bg2)',
                borderRadius: 'var(--wf-radius-card)',
                marginBottom: 16,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  const memberDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    : ''
  const initial = (username || user.email || '?').charAt(0).toUpperCase()
  const daily = stats?.daily
  const worldRank: number | null = null // not exposed by /api/stats today; render unranked

  // Stat values (handle missing avgDurationSeconds — render "—" per plan Q1).
  const avgTimeSec =
    daily?.avgDurationSeconds ??
    (typeof daily?.avgTime === 'number' ? daily.avgTime : undefined)

  const cellBorder = '1px solid var(--wf-border)'

  const stat = (label: string, value: string, accent: boolean) => (
    <div style={{ textAlign: 'center', padding: isMobile ? '12px 4px' : '16px 8px' }}>
      <div
        style={{
          fontFamily: 'var(--wf-font-head)',
          fontSize: isMobile ? 20 : 30,
          fontWeight: 600,
          color: accent ? 'var(--wf-accent)' : 'var(--wf-ink)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: 'var(--wf-font-ui)',
          fontSize: isMobile ? 10 : 11,
          fontWeight: 500,
          color: 'var(--wf-muted)',
          lineHeight: 1.4,
        }}
      >
        {label}
      </div>
    </div>
  )

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

        {/* Identity card */}
        <div
          style={{
            background: 'var(--wf-surface)',
            border: '1px solid var(--wf-border)',
            borderRadius: 'var(--wf-radius-card)',
            padding: isMobile ? 12 : 20,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 12 : 20,
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: isMobile ? 52 : 78,
              height: isMobile ? 52 : 78,
              borderRadius: '50%',
              background:
                'linear-gradient(135deg, var(--wf-accent), var(--wf-border-strong))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--wf-font-head)',
              fontSize: isMobile ? 22 : 30,
              fontWeight: 700,
              color: 'var(--wf-accent-ink)',
              textTransform: 'uppercase',
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--wf-font-head)',
                fontSize: isMobile ? 17 : 24,
                fontWeight: 600,
                color: 'var(--wf-ink)',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {username || user.email}
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: 'var(--wf-font-ui)',
                fontSize: isMobile ? 11.5 : 13,
                color: 'var(--wf-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {isMobile ? t.metaCompact(worldRank) : t.metaDesktop(memberDate, worldRank)}
            </div>
            {badges.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                {badges.slice(0, 3).map(b => (
                  <span
                    key={b.key}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: 'var(--wf-bg2)',
                      border: '1px solid var(--wf-border)',
                      fontFamily: 'var(--wf-font-ui)',
                      fontSize: isMobile ? 10 : 11.5,
                      fontWeight: 500,
                      color: 'var(--wf-muted)',
                    }}
                  >
                    {b.icon} {b.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          {!isMobile && (
            <button
              onClick={handleEditClick}
              style={{
                flexShrink: 0,
                padding: '8px 16px',
                fontFamily: 'var(--wf-font-ui)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--wf-ink)',
                background: 'transparent',
                border: '1px solid var(--wf-border-strong)',
                borderRadius: 'var(--wf-radius)',
                cursor: 'pointer',
              }}
            >
              {t.edit}
            </button>
          )}
        </div>

        {/* Stats card */}
        <div
          style={{
            background: 'var(--wf-surface)',
            border: '1px solid var(--wf-border)',
            borderRadius: 'var(--wf-radius-card)',
            padding: isMobile ? 14 : 20,
            marginBottom: 16,
          }}
        >
          {sectionLabel(t.statsLabel)}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              rowGap: 0,
              columnGap: 8,
            }}
          >
            {/* Row 1 */}
            <div>{stat(t.stat1, String(daily?.totalGames ?? 0), true)}</div>
            <div>{stat(t.stat2, `${daily?.winRate ?? 0}%`, true)}</div>
            <div
              style={{ borderTop: !isMobile ? 'none' : undefined }}
            >
              {stat(t.stat3, (daily?.avgGuesses ?? 0).toFixed(1), true)}
            </div>
            <div>{stat(t.stat4, (daily?.bestScore ?? 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US'), true)}</div>
            {/* Row 2 — desktop divider */}
            <div style={{ borderTop: !isMobile ? cellBorder : 'none' }}>
              {stat(t.stat5, Math.round(daily?.avgScore ?? 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US'), true)}
            </div>
            <div style={{ borderTop: !isMobile ? cellBorder : 'none' }}>
              {stat(t.stat6, String(daily?.totalWins ?? 0), true)}
            </div>
            <div style={{ borderTop: !isMobile ? cellBorder : 'none' }}>
              {stat(t.stat7, formatDuration(avgTimeSec), false)}
            </div>
            <div style={{ borderTop: !isMobile ? cellBorder : 'none' }}>
              {stat(t.stat8, String(daily?.bestStreak ?? 0), false)}
            </div>
          </div>
        </div>

        {/* Dual cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16,
            marginBottom: 16,
          }}
        >
          {/* SÉRIE */}
          <div
            style={{
              background: 'var(--wf-surface)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius-card)',
              padding: isMobile ? 14 : 20,
            }}
          >
            {sectionLabel(t.serieLabel)}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'var(--wf-font-head)',
                  fontSize: isMobile ? 30 : 48,
                  fontWeight: 700,
                  color: 'var(--wf-accent)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {daily?.streak ?? 0}
              </span>
              <span style={{ fontSize: isMobile ? 18 : 24 }} aria-hidden>
                🔥
              </span>
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: 'var(--wf-font-ui)',
                fontSize: isMobile ? 11.5 : 13,
                color: 'var(--wf-muted)',
                lineHeight: 1.4,
              }}
            >
              {isMobile ? t.serieCaptionCompact : t.serieCaption}
            </div>
          </div>

          {/* RAPPEL */}
          <div
            style={{
              background: 'var(--wf-surface)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius-card)',
              padding: isMobile ? 14 : 20,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {sectionLabel(t.rappelLabel)}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flex: 1,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--wf-font-ui)',
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 500,
                  color: 'var(--wf-ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {isMobile ? t.rappelCompact : t.rappelDesktop}
              </div>
              <button
                role="switch"
                aria-checked={reminderOn}
                onClick={() => setReminderOn(v => !v)}
                style={{
                  position: 'relative',
                  width: 40,
                  height: 22,
                  borderRadius: 999,
                  border: '1px solid var(--wf-border)',
                  background: reminderOn ? 'var(--wf-accent)' : 'var(--wf-bg2)',
                  cursor: 'pointer',
                  transition: 'background 180ms cubic-bezier(.4,.4,0,1.2)',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: reminderOn ? 20 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: reminderOn ? 'var(--wf-accent-ink)' : 'var(--wf-muted)',
                    transition: 'left 180ms cubic-bezier(.4,.4,0,1.2)',
                  }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Preferences card */}
        <div
          style={{
            background: 'var(--wf-surface)',
            border: '1px solid var(--wf-border)',
            borderRadius: 'var(--wf-radius-card)',
            padding: isMobile ? 14 : 20,
            marginBottom: 16,
          }}
        >
          {sectionLabel(t.prefsLabel)}
          <Preferences />
        </div>
      </div>

      {/* Edit toast (D-07 stub) */}
      {editToast && (
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
            color: 'var(--wf-ink)',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {t.editToast}
        </div>
      )}
    </div>
  )
}
