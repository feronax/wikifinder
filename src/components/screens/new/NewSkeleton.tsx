'use client'

/**
 * NewSkeleton — Phase 13 / Plan 04 (POL-04, D-10).
 *
 * Shared loading-skeleton primitive for the new-design screen tree. Extracted
 * verbatim from NewProfileScreen.tsx:156-189 ("Functional skeleton (D-09)")
 * and parameterized so all 5 new screens (Game, History, Leaderboard,
 * Profile, Friends) consume a single skeleton aesthetic.
 *
 * Tokens: var(--wf-*) only — zero hardcoded hex.
 */

import { useIsMobile } from '@/lib/utils'
import NewDesignHeader from '@/components/game/new/NewDesignHeader'

interface NewSkeletonProps {
  lang: 'fr' | 'en'
  // When true, parent already mounts the page chrome (e.g. Game tab inside
  // MobileShell). The skeleton renders without its own NewDesignHeader.
  headerless?: boolean
  // Pixel heights for the staggered grey panels. Default mirrors the
  // NewProfileScreen reference geometry ([100, 220, 140]).
  blocks?: number[]
}

export default function NewSkeleton({
  lang,
  headerless = false,
  blocks = [100, 220, 140],
}: NewSkeletonProps) {
  const isMobile = useIsMobile()
  const containerPadding = isMobile ? '4px 0 60px' : '32px 24px 80px'
  return (
    <div style={{ minHeight: headerless ? 'auto' : '100vh', background: 'var(--wf-bg)' }}>
      {!headerless && <NewDesignHeader lang={lang} />}
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
        {blocks.map((h, i) => (
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
