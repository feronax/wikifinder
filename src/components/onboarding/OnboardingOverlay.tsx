'use client'

import { useEffect, useState } from 'react'

// RET-01 / D-18 / D-19 / D-21 — 3-step rules explainer, localStorage-gated,
// auth-agnostic. Scrim-click does NOT dismiss (planner UX lock — see UI-SPEC);
// ESC and close-X do. All timer/listener cleanup per HARD-06.
const FLAG = 'wf_onboarded_v1'

type Props = { lang?: 'fr' | 'en' }

const COPY = {
    fr: {
        steps: [
            { title: 'Devine les mots', body: "Trouve les mots de l'article masqué pour le révéler petit à petit." },
            { title: 'Trouve le titre', body: 'Quand tu devines le titre, tu gagnes la partie.' },
            { title: 'Un nouveau chaque jour', body: 'Un nouvel article tous les jours à minuit, heure de Paris.' },
        ],
        next: 'Suivant',
        done: 'Commencer',
        close: 'Fermer',
        counter: (i: number, total: number) => `${i + 1} / ${total}`,
    },
    en: {
        steps: [
            { title: 'Guess words', body: 'Find words from the masked article to reveal it bit by bit.' },
            { title: 'Find the title', body: 'When you guess the title, you win the game.' },
            { title: 'A new one every day', body: 'A new article every day at midnight Paris time.' },
        ],
        next: 'Next',
        done: 'Start',
        close: 'Close',
        counter: (i: number, total: number) => `${i + 1} / ${total}`,
    },
} as const

export default function OnboardingOverlay({ lang = 'fr' }: Props) {
    // Start closed — avoids SSR/hydration mismatch. Client effect opens it
    // post-hydration if the flag is absent.
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState(0)

    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            if (localStorage.getItem(FLAG) === '1') return
        } catch {
            return
        }
        // Intentional: SSR-safe gate. Server renders nothing; client opens
        // post-hydration only for users without the localStorage flag. No
        // cascading render — setOpen(true) is terminal for this effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpen(true)
    }, [])

    function dismiss() {
        try {
            localStorage.setItem(FLAG, '1')
        } catch {
            // quota / private-mode — onboarding just re-shows next visit (T-05-25 accepted)
        }
        setOpen(false)
    }

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') dismiss()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open])

    if (!open) return null

    const c = COPY[lang]
    const total = c.steps.length
    const isLast = step === total - 1

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={c.steps[step].title}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
            }}
        >
            <div
                style={{
                    position: 'relative',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 24,
                    maxWidth: 420,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--text)',
                }}
            >
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label={c.close}
                    style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: 20,
                        lineHeight: 1,
                    }}
                >
                    ×
                </button>

                <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{c.counter(step, total)}</div>
                <h2 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2, margin: 0, color: 'var(--text)' }}>
                    {c.steps[step].title}
                </h2>
                <p style={{ fontSize: 16, lineHeight: 1.5, margin: 0, color: 'var(--text)' }}>
                    {c.steps[step].body}
                </p>

                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 4 }}>
                    {c.steps.map((_, i) => (
                        <span
                            key={i}
                            aria-hidden
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                background: i === step ? 'var(--accent)' : 'var(--border)',
                                transition: 'background 0.15s',
                            }}
                        />
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => (isLast ? dismiss() : setStep(s => s + 1))}
                    style={{
                        minHeight: 44,
                        padding: '0 24px',
                        borderRadius: 8,
                        background: 'var(--accent)',
                        color: 'var(--surface)',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: 15,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        marginTop: 4,
                    }}
                >
                    {isLast ? c.done : c.next}
                </button>
            </div>
        </div>
    )
}
