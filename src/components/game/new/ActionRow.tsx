'use client'

import { useState } from 'react'
import ActionRowButton from './ActionRowButton'
import GiveUpConfirmDialog from '@/components/game/GiveUpConfirmDialog'

export interface ActionRowProps {
  lang: 'fr' | 'en'
  won: boolean
  gameId: string
  pageId: string
  hintsUsed?: number
  onHintClick: () => void
  onGiveUpConfirmed: (revealData: unknown) => void
  onDuelCreate: () => Promise<void>
}

export default function ActionRow({
  lang,
  won,
  pageId,
  hintsUsed = 0,
  onHintClick,
  onGiveUpConfirmed,
  onDuelCreate,
}: ActionRowProps) {
  const [giveUpOpen, setGiveUpOpen] = useState(false)
  const hintsLeft = Math.max(0, 3 - hintsUsed)

  const indiceLabel = lang === 'fr' ? 'Indice' : 'Hint'
  const indiceSubtext =
    lang === 'fr'
      ? `-500 pts · ${hintsLeft} restant${hintsLeft > 1 ? 's' : ''}`
      : `-500 pts · ${hintsLeft} left`
  const abandonnerLabel = lang === 'fr' ? 'Abandonner' : 'Give up'
  const defierLabel = lang === 'fr' ? 'Défier un ami' : 'Challenge a friend'

  // GiveUpConfirmDialog expects `t: { title, body: (nextLives) => string, confirm, cancel }`.
  // For daily there is no lives concept; body() ignores the arg.
  const giveUpT =
    lang === 'fr'
      ? {
          title: 'Abandonner la partie ?',
          body: () =>
            "L'article sera révélé et votre partie sera terminée.",
          confirm: 'Abandonner',
          cancel: 'Annuler',
        }
      : {
          title: 'Give up?',
          body: () =>
            'The article will be revealed and your game will end.',
          confirm: 'Give up',
          cancel: 'Cancel',
        }

  async function handleGiveUpConfirm() {
    try {
      // Payload shape matches legacy /api/game/reveal call at page.tsx:1432
      // (pageId + lang; no gameId). Response shape: { revealedAll: [{index, value}, ...] }.
      const resp = await fetch('/api/game/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, lang }),
      })
      if (resp.ok) {
        const revealData = await resp.json()
        onGiveUpConfirmed(revealData)
      }
    } catch {
      /* silent per CLAUDE.md — Sentry catches */
    } finally {
      setGiveUpOpen(false)
    }
  }

  return (
    <>
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
        <ActionRowButton
          label={indiceLabel}
          subtext={indiceSubtext}
          disabled={true}
          onClick={onHintClick}
        />
        <ActionRowButton
          label={abandonnerLabel}
          variant="destructive"
          disabled={won}
          onClick={() => setGiveUpOpen(true)}
        />
        <ActionRowButton label={defierLabel} onClick={onDuelCreate} />
      </section>
      <GiveUpConfirmDialog
        open={giveUpOpen}
        livesRemaining={1}
        t={giveUpT}
        onConfirm={handleGiveUpConfirm}
        onCancel={() => setGiveUpOpen(false)}
      />
    </>
  )
}
