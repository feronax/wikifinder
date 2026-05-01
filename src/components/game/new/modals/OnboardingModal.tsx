'use client'

// Phase 12 / Plan 02 — MOD-01 net-new Onboarding modal for the new design.
//
// Locked decisions implemented here:
//   D-01 — Four steps (Goal → Mechanic → Reveal & score → Modes).
//   D-02 — Skip button visible on every step.
//   D-03 — Component is parent-controlled. The parent (Plan 05) decides
//          when to auto-open on first visit vs. burger re-trigger; the
//          component only writes the `wf_onboarded_v1` localStorage gate
//          when the user actually dismisses (Skip / Get started / X / Esc).
//          Re-triggering from the burger menu therefore never re-arms the
//          gate from the component's perspective — it is already set, and
//          dismissing again just rewrites the same '1'.
//   D-04 — Horizontal slide between steps via translateX on a flex track.
//   D-05 — EN/FR copy gated by the `lang` prop.
//   D-06 — Gate key is `wf_onboarded_v1`; written on dismiss only.
//
// Per CLAUDE.md "no Tailwind in new tree": all styles inline, var(--wf-*)
// tokens only. This file is NOT imported anywhere yet — Plan 05 wires it
// into app/game/page.tsx + BurgerDrawer.

import { useEffect, useState } from 'react'
import ModalShell from '@/components/game/new/ModalShell'

type Props = {
  open: boolean
  onClose: () => void
  lang: 'fr' | 'en'
}

const COPY = {
  fr: {
    steps: [
      {
        title: 'Trouvez l’article caché',
        body: 'Chaque jour, un article Wikipédia est masqué. Votre mission : deviner son titre.',
      },
      {
        title: 'Tapez vos mots',
        body: 'Entrez n’importe quel mot. S’il apparaît dans l’article, toutes ses occurrences sont révélées.',
      },
      {
        title: 'Révélation et score',
        body: 'Les mots courants sont déjà visibles. Moins vous essayez et plus vous êtes rapide, meilleur est votre score.',
      },
      {
        title: 'Trois modes de jeu',
        body: 'Quotidien : un article par jour. Classé : enchaînez les manches pour grimper au classement. Survie : tenez le plus longtemps possible.',
      },
    ],
    skip: 'Passer',
    back: 'Précédent',
    next: 'Suivant',
    done: 'Commencer',
  },
  en: {
    steps: [
      {
        title: 'Find the hidden article',
        body: 'Every day a Wikipedia article is masked. Your mission: guess its title.',
      },
      {
        title: 'Type any word',
        body: 'Enter any word. If it appears in the article, every occurrence reveals.',
      },
      {
        title: 'Reveal and score',
        body: 'Common stopwords are already visible. The fewer guesses and the faster you are, the higher your score.',
      },
      {
        title: 'Three game modes',
        body: 'Daily: one article a day. Ranked: chain rounds to climb the leaderboard. Survival: last as long as you can.',
      },
    ],
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    done: 'Get started',
  },
} as const

export default function OnboardingModal({ open, onClose, lang }: Props) {
  const c = COPY[lang]
  const [step, setStep] = useState(0)
  // Lazy initial state keeps the matchMedia read out of the effect body
  // (avoids react-hooks/set-state-in-effect). SSR-safe: typeof window check
  // means the initial server render returns false, then the subscription
  // effect below keeps the value in sync once mounted.
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  // Reduced-motion subscription (Pattern S5 from 12-PATTERNS.md, mirrored
  // from BurgerDrawer.tsx). Effect only subscribes; initial value comes
  // from the lazy useState initializer above.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Reset to step 0 on each open transition — burger re-trigger should
  // start fresh at step 1, not resume mid-tour. Pattern: "adjusting state
  // when a prop changes" via prev-prop in state
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  // This is the React-blessed alternative to a setState-in-effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setStep(0)
  }

  function dismiss() {
    try {
      localStorage.setItem('wf_onboarded_v1', '1')
    } catch {
      /* private mode / storage disabled — silent fail, modal still closes */
    }
    onClose()
  }

  const dur = reduced ? 0 : 260
  const easing = 'cubic-bezier(.2,.8,.2,1)'
  const isLast = step === c.steps.length - 1

  return (
    <ModalShell open={open} onClose={dismiss} ariaLabelledBy="onb-heading">
      <div
        data-testid="onboarding-modal"
        style={{ minWidth: 280, maxWidth: 432 }}
      >
        {/* Slide track — translateX advances by (step / total) * 100% so
            each panel takes 1/N of the track width. */}
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              width: `${c.steps.length * 100}%`,
              transform: `translateX(-${(step / c.steps.length) * 100}%)`,
              transition: `transform ${dur}ms ${easing}`,
            }}
          >
            {c.steps.map((s, i) => (
              <div
                key={i}
                data-testid={`onb-step-${i}`}
                aria-hidden={i !== step}
                style={{
                  flex: `0 0 ${100 / c.steps.length}%`,
                  padding: '4px 4px 8px',
                }}
              >
                <h2
                  id={i === step ? 'onb-heading' : undefined}
                  style={{
                    fontFamily: 'var(--wf-font-head)',
                    fontSize: 20,
                    fontWeight: 600,
                    color: 'var(--wf-ink)',
                    margin: '0 0 12px',
                    lineHeight: 1.3,
                  }}
                >
                  {s.title}
                </h2>
                <p
                  style={{
                    fontFamily: 'var(--wf-font-ui)',
                    fontSize: 15,
                    color: 'var(--wf-muted)',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Progress dots — D-01 requires exactly 4. */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            justifyContent: 'center',
            marginTop: 24,
          }}
          aria-hidden
        >
          {c.steps.map((_, i) => (
            <span
              key={i}
              data-testid="onb-dot"
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background:
                  i === step ? 'var(--wf-accent)' : 'var(--wf-border)',
                transition: 'background 150ms ease',
              }}
            />
          ))}
        </div>

        {/* Action row — Skip is rendered unconditionally on every step
            (D-02). Back is hidden on step 0 to avoid a dead control. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 20,
            gap: 8,
          }}
        >
          <button
            type="button"
            data-testid="onb-skip"
            onClick={dismiss}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--wf-muted)',
              fontFamily: 'var(--wf-font-ui)',
              fontSize: 14,
              cursor: 'pointer',
              padding: '8px 0',
            }}
          >
            {c.skip}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                type="button"
                data-testid="onb-back"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--wf-border)',
                  color: 'var(--wf-ink)',
                  borderRadius: 'var(--wf-radius)',
                  padding: '8px 16px',
                  fontFamily: 'var(--wf-font-ui)',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                {c.back}
              </button>
            )}
            <button
              type="button"
              data-testid="onb-next"
              onClick={() =>
                isLast ? dismiss() : setStep((s) => Math.min(c.steps.length - 1, s + 1))
              }
              style={{
                background: 'var(--wf-accent)',
                color: 'var(--wf-accent-ink)',
                border: 0,
                borderRadius: 'var(--wf-radius)',
                padding: '8px 16px',
                fontFamily: 'var(--wf-font-ui)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isLast ? c.done : c.next}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
