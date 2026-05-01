'use client'

// Phase 12 / Plan 03 — MOD-03 net-new Feedback modal for the new design.
//
// Locked decisions implemented here:
//   D-13 — Categories: bug / suggestion / article / other.
//   D-14 — Default category = 'other' (lowest friction); message required,
//          min 30 chars; submit blocked under threshold (matches server-side
//          Zod rule at api/feedback/route.ts:11-14).
//   D-15 — Component is a modal; entry point is the burger drawer (Plan 05
//          owns wiring). This file ships isolated.
//   D-16 — Auto-prefill metadata (category, lang, gameId, won, guesses, ua)
//          is appended as a `[meta] ...` footer block to the user's message
//          string. The user textarea stays clean.
//   D-17 — POST /api/feedback unchanged. Body shape is exactly
//          { message, pageId } — the route's Zod schema rejects unknown
//          keys, so all metadata MUST go into the message string itself.
//
// Per CLAUDE.md "no Tailwind in new tree": all styles inline, var(--wf-*)
// tokens only. This file is NOT imported anywhere yet — Plan 05 wires it
// into app/game/page.tsx + BurgerDrawer.
//
// Hooks-strict patterns mirrored from OnboardingModal.tsx:
//   - Form state reset on each open transition uses prev-prop-in-state
//     (React-blessed alternative to react-hooks/set-state-in-effect).
//   - navigator.userAgent is read inside the submit handler (event-time),
//     never during render (SSR-safe).

import { useState } from 'react'
import ModalShell from '@/components/game/new/ModalShell'
import type { GameState } from '@/app/game/types'

type Category = 'bug' | 'suggestion' | 'article' | 'other'
const CATEGORIES: Category[] = ['bug', 'suggestion', 'article', 'other']

type Props = {
  open: boolean
  onClose: () => void
  lang: 'fr' | 'en'
  gameState: GameState | null
}

const COPY = {
  fr: {
    heading: 'Signaler un problème',
    catLabel: {
      bug: 'Bug',
      suggestion: 'Suggestion',
      article: 'Article',
      other: 'Autre',
    },
    placeholder: 'Décrivez le problème ou votre suggestion (30 caractères min.)',
    submit: 'Envoyer',
    sending: 'Envoi…',
    sent: 'Merci !',
    error: 'Une erreur est survenue. Réessayer ?',
    cancel: 'Annuler',
  },
  en: {
    heading: 'Send feedback',
    catLabel: {
      bug: 'Bug',
      suggestion: 'Suggestion',
      article: 'Article',
      other: 'Other',
    },
    placeholder: 'Describe the issue or your suggestion (30 chars min)',
    submit: 'Send',
    sending: 'Sending…',
    sent: 'Thanks!',
    error: 'Something went wrong. Retry?',
    cancel: 'Cancel',
  },
} as const

export default function FeedbackModal({ open, onClose, lang, gameState }: Props) {
  const c = COPY[lang]
  const [category, setCategory] = useState<Category>('other')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)

  // Reset form state on each open transition. Pattern: "adjusting state
  // when a prop changes" via prev-prop in state — the React-blessed
  // alternative to setState-in-effect, mirrored from OnboardingModal.tsx.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setCategory('other')
      setMsg('')
      setLoading(false)
      setSent(false)
      setError(false)
    }
  }

  const charCount = msg.trim().length
  const canSubmit = charCount >= 30 && !loading && !sent

  async function handleSubmit() {
    const userMessage = msg.trim()
    if (userMessage.length < 30) return
    setLoading(true)
    setError(false)
    // SSR-safe: navigator only read at event time (handler is client-only).
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '-'
    // D-16 metadata footer — exhaustive set of [meta] lines required by the
    // Plan-01 RED spec (modals-feedback.spec.ts).
    const meta = [
      '---',
      `[meta] category: ${category}`,
      `[meta] lang: ${lang}`,
      `[meta] gameId: ${gameState?.gameId ?? '-'}`,
      `[meta] won: ${gameState?.won ?? '-'}`,
      `[meta] guesses: ${gameState?.guessCount ?? '-'}`,
      `[meta] ua: ${ua}`,
    ].join('\n')
    // Server max is 2000 chars (route.ts FeedbackBodySchema). Textarea is
    // capped at 1700 (headroom for meta block); the slice is a defense in
    // depth in case the meta lines grow.
    const fullMessage = `${userMessage}\n\n${meta}`.slice(0, 2000)
    const pageId =
      gameState && gameState.pageData && typeof gameState.pageData.id === 'string'
        ? gameState.pageData.id
        : null
    try {
      // D-17: body shape is EXACTLY { message, pageId }. No extra keys —
      // the route's Zod schema rejects unknown keys.
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fullMessage, pageId }),
      })
      if (res.ok) {
        setSent(true)
        setTimeout(() => onClose(), 1500)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} ariaLabelledBy="fb-heading">
      <div
        data-testid="feedback-modal"
        style={{ minWidth: 280, maxWidth: 432 }}
      >
        <h2
          id="fb-heading"
          style={{
            fontFamily: 'var(--wf-font-head)',
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--wf-ink)',
            margin: '0 0 16px',
            lineHeight: 1.3,
          }}
        >
          {c.heading}
        </h2>

        {/* Category pills — D-13. Default selection is `other` (D-14). */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 12,
          }}
        >
          {CATEGORIES.map((cat) => {
            const selected = category === cat
            return (
              <button
                key={cat}
                type="button"
                data-testid={`feedback-cat-${cat}`}
                onClick={() => setCategory(cat)}
                aria-pressed={selected}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: `1px solid ${selected ? 'var(--wf-accent)' : 'var(--wf-border)'}`,
                  background: selected ? 'var(--wf-accent)' : 'transparent',
                  color: selected ? 'var(--wf-accent-ink)' : 'var(--wf-ink)',
                  fontFamily: 'var(--wf-font-ui)',
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
                }}
              >
                {c.catLabel[cat]}
              </button>
            )
          })}
        </div>

        {/* Textarea — maxLength leaves headroom for the meta footer block. */}
        <textarea
          data-testid="feedback-textarea"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={5}
          maxLength={1700}
          placeholder={c.placeholder}
          disabled={loading || sent}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid var(--wf-border)',
            backgroundColor: 'var(--wf-bg)',
            color: 'var(--wf-ink)',
            fontFamily: 'var(--wf-font-ui)',
            fontSize: 14,
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {/* Char counter — accent-colored once threshold is met (D-14). */}
        <div
          style={{
            fontSize: 12,
            textAlign: 'right',
            marginTop: 4,
            fontFamily: 'var(--wf-font-ui)',
            color: charCount >= 30 ? 'var(--wf-accent)' : 'var(--wf-muted)',
          }}
        >
          {charCount} / 30
        </div>

        {error && (
          <div
            data-testid="feedback-error"
            role="alert"
            style={{
              marginTop: 8,
              color: 'var(--wf-accent)',
              fontFamily: 'var(--wf-font-ui)',
              fontSize: 13,
            }}
          >
            {c.error}
          </div>
        )}
        {sent && (
          <div
            data-testid="feedback-sent"
            role="status"
            style={{
              marginTop: 8,
              color: 'var(--wf-accent)',
              fontFamily: 'var(--wf-font-ui)',
              fontSize: 13,
            }}
          >
            {c.sent}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            data-testid="feedback-cancel"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: '1px solid var(--wf-border)',
              color: 'var(--wf-ink)',
              borderRadius: 'var(--wf-radius)',
              padding: '8px 16px',
              fontFamily: 'var(--wf-font-ui)',
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {c.cancel}
          </button>
          <button
            type="button"
            data-testid="feedback-submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? 'var(--wf-accent)' : 'var(--wf-border)',
              color: 'var(--wf-accent-ink)',
              border: 0,
              borderRadius: 'var(--wf-radius)',
              padding: '8px 16px',
              fontFamily: 'var(--wf-font-ui)',
              fontSize: 14,
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            {loading ? c.sending : sent ? c.sent : c.submit}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
