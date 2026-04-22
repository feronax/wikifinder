'use client'

import ActionRowButton from './ActionRowButton'

// Phase 10.3-08 — scope change: Indice (Hint) and Abandonner (Give up)
// buttons removed from the new-design Actions surface per UAT feedback.
// HintConfirmDialog.tsx, GiveUpConfirmDialog.tsx, /api/game/hint route,
// and hints_used migrations remain on disk as dormant code for a future
// revisit (Gaps B + C). Removing the hint UI also removes the cosmetic
// hintsUsed*500 deduction path that caused POINTS=0 in ResultModal (Gap E).

export interface ActionRowProps {
  lang: 'fr' | 'en'
  onDuelCreate: () => Promise<void>
}

export default function ActionRow({ lang, onDuelCreate }: ActionRowProps) {
  const defierLabel = lang === 'fr' ? 'Défier un ami' : 'Challenge a friend'
  return (
    <section
      style={{
        background: 'var(--wf-surface)',
        border: '1px solid var(--wf-border)',
        borderRadius: 'var(--wf-radius-card)',
        padding: 16,
        fontFamily: 'var(--wf-font-ui)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <ActionRowButton label={defierLabel} onClick={onDuelCreate} />
    </section>
  )
}
