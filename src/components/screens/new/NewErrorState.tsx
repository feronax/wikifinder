'use client'

/**
 * NewErrorState — Phase 13 / Plan 04 (POL-04, D-10).
 *
 * Shared error-state primitive for the new-design screen tree. Same shell as
 * NewSkeleton (header + bounded container) so error → reload → success
 * transitions don't shift layout. Optional retry CTA delegates to
 * ActionRowButton for token + a11y parity with the rest of the new tree.
 *
 * Tokens: var(--wf-*) only — zero hardcoded hex.
 */

import { useIsMobile } from '@/lib/utils'
import NewDesignHeader from '@/components/game/new/NewDesignHeader'
import ActionRowButton from '@/components/game/new/ActionRowButton'

interface NewErrorStateProps {
  lang: 'fr' | 'en'
  headerless?: boolean
  message?: string
  onRetry?: () => void | Promise<void>
}

export default function NewErrorState({
  lang,
  headerless = false,
  message,
  onRetry,
}: NewErrorStateProps) {
  const isMobile = useIsMobile()
  const headline = lang === 'fr' ? 'Une erreur est survenue' : 'Something went wrong'
  const sub = message ?? (lang === 'fr' ? 'Réessaie dans un instant.' : 'Please try again.')
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
