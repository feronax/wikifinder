'use client'

import { useState } from 'react'
import ModalShell from './ModalShell'
import ActionRowButton from './ActionRowButton'

// Phase 10.3 P5 — HintConfirmDialog.
// Minimal confirmation dialog for the Indice (hint) action. Renders via ModalShell
// (from 10.3-02) so chrome / a11y / focus-trap / body-scroll-lock / Esc / backdrop
// semantics are already satisfied. Caller owns the hint POST — this component only
// asks "are you sure?" and, on confirm, awaits caller-supplied onConfirm().
//
// Scope per plan 10.3-05 Task 3: STOPS at this file. Wire-up (ActionRow / page.tsx /
// mobile) is plan 10.3-06.

export interface HintConfirmDialogProps {
  open: boolean
  onClose: () => void
  lang: 'fr' | 'en'
  onConfirm: () => Promise<void>
}

export default function HintConfirmDialog({
  open,
  onClose,
  lang,
  onConfirm,
}: HintConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      /* silent per CLAUDE.md — Sentry catches server-side */
    } finally {
      setBusy(false)
    }
  }

  const heading =
    lang === 'fr'
      ? 'Révéler un indice pour −500 points ?'
      : 'Reveal a hint for −500 points?'
  const body =
    lang === 'fr'
      ? "Un mot caché du corps de l'article sera révélé au hasard. Limite : 3 indices par partie."
      : 'A random hidden word from the article body will be revealed. Limit: 3 hints per game.'

  return (
    <ModalShell open={open} onClose={onClose} ariaLabelledBy="hint-confirm-heading">
      <h2
        id="hint-confirm-heading"
        style={{
          margin: 0,
          marginRight: 40,
          fontFamily: 'var(--wf-font-head)',
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--wf-ink)',
        }}
      >
        {heading}
      </h2>
      <p
        style={{
          marginTop: 12,
          marginBottom: 0,
          fontSize: 14,
          color: 'var(--wf-muted)',
          fontFamily: 'var(--wf-font-ui)',
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <ActionRowButton
          label={lang === 'fr' ? 'Annuler' : 'Cancel'}
          onClick={onClose}
          disabled={busy}
        />
        <ActionRowButton
          label={lang === 'fr' ? 'Confirmer' : 'Confirm'}
          onClick={handleConfirm}
          busy={busy}
        />
      </div>
    </ModalShell>
  )
}
