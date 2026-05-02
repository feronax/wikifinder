'use client'

/**
 * RankedRow — shared ranked-list primitive (Phase 11 Pitfall 7).
 *
 * Single source of truth for ranked-tab row chrome: medal + avatar + VOUS badge
 * + accent points. Consumed by NewLeaderboardScreen (ranked tab) and
 * NewRankedScreen (Plan 09).
 *
 * Tokens: `--wf-*` namespace only (legacy unprefixed tokens are forbidden
 * per Phase 7 D-03a). All numbers use font-variant-numeric: tabular-nums.
 *
 * Light-theme contrast lock (UI-SPEC §Color): the "VOUS" pill is 10/600 accent
 * which is ≈3:1 in light theme — we ship `text-decoration: underline dotted` as
 * the WCAG fallback per Handoff §10.
 */

import { useIsMobile } from '@/lib/utils'

export type RankedRowProps = {
  rank: number
  username: string
  points: number
  isSelf?: boolean
  selfLabel?: string // "VOUS" / "YOU"
}

export default function RankedRow({ rank, username, points, isSelf, selfLabel }: RankedRowProps) {
  const isMobile = useIsMobile()
  const isMedal = rank <= 3
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
  const avatarInitial = (username[0] ?? '?').toUpperCase()

  // Desktop: 50px rank / 1fr player / 90px points (right-aligned accent).
  // Compact: 28px rank / 1fr player / auto meta.
  const gridTemplate = isMobile ? '28px 1fr auto' : '50px 1fr 90px'
  const padding = isMobile ? '10px 12px' : '14px 18px'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        alignItems: 'center',
        padding,
        borderTop: '1px solid var(--wf-border)',
        borderLeft: isSelf ? '3px solid var(--wf-accent)' : '3px solid transparent',
        background: isSelf
          ? 'color-mix(in oklch, var(--wf-accent) 10%, var(--wf-surface))'
          : 'transparent',
        fontFamily: 'var(--wf-font-ui)',
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
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
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
          {username}
        </span>
        {isSelf && selfLabel && (
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
            {selfLabel}
          </span>
        )}
      </span>
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
        {points.toLocaleString('fr-FR')}
      </span>
    </div>
  )
}
