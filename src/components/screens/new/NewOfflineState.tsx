'use client'

/**
 * NewOfflineState — Phase 13 / Plan 04 (POL-04, D-10).
 *
 * Shared offline-state primitive. Same shell as NewSkeleton + NewErrorState.
 * Held as v1.2-ready: no screen wires offline detection in this phase, but
 * the primitive ships now so v1.2 offline-detection consumers don't have to
 * invent a new aesthetic (POL-04 satisfied at primitive level).
 *
 * Tokens: var(--wf-*) only — zero hardcoded hex.
 */

import { useIsMobile } from '@/lib/utils'
import NewDesignHeader from '@/components/game/new/NewDesignHeader'
import ActionRowButton from '@/components/game/new/ActionRowButton'

interface NewOfflineStateProps {
  lang: 'fr' | 'en'
  headerless?: boolean
  onRetry?: () => void | Promise<void>
}

export default function NewOfflineState({
  lang,
  headerless = false,
  onRetry,
}: NewOfflineStateProps) {
  const isMobile = useIsMobile()
  const headline = lang === 'fr' ? 'Hors ligne' : 'Offline'
  const sub =
    lang === 'fr' ? 'Vérifie ta connexion et réessaie.' : 'Check your connection and try again.'
  const retryLabel = lang === 'fr' ? 'Réessayer' : 'Retry'
  const containerPadding = isMobile ? '4px 16px 60px' : '32px 24px 80px'
  return (
    <div style={{ minHeight: headerless ? 'auto' : '100vh', background: 'var(--wf-bg)' }}>
      {!headerless && <NewDesignHeader lang={lang} />}
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: containerPadding,
          fontFamily: 'var(--wf-font-ui)',
        }}
      >
        <h2
          style={{
            color: 'var(--wf-ink)',
            fontSize: isMobile ? 20 : 24,
            marginBottom: 8,
          }}
        >
          {headline}
        </h2>
        <p style={{ color: 'var(--wf-muted)', marginBottom: 24 }}>{sub}</p>
        {onRetry && <ActionRowButton label={retryLabel} onClick={onRetry} variant="neutral" />}
      </div>
    </div>
  )
}
