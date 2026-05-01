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
  // Phase 13 / Plan 04 (D-12, MOD-03): defeat "Voir la solution" CTA.
  // Undefined when the game is won OR when the user is still able to keep
  // guessing — the button is hidden. When provided, clicking flips
  // page-level revealAll to true, which fires Phase 12 Plan 05's dormant
  // defeat-trigger (revealAll && !won → ResultModal opens automatically).
  // No new endpoint, no new state machinery.
  onRevealSolution?: () => void
}

export default function ActionRow({ lang, onDuelCreate, onRevealSolution }: ActionRowProps) {
  const defierLabel = lang === 'fr' ? 'Défier un ami' : 'Challenge a friend'
  const revealLabel = lang === 'fr' ? 'Voir la solution' : 'See the answer'
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
      {onRevealSolution && (
        <ActionRowButton
          label={revealLabel}
          variant="destructive"
          onClick={onRevealSolution}
        />
      )}
    </section>
  )
}
