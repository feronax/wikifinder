'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const translations = {
  fr: {
    subtitle: 'Chaque jour, un article Wikipedia à deviner.',
    subtitle2: 'Mot par mot. En un minimum de tentatives.',
    play: 'Jouer',
    howToPlay: 'Comment jouer',
    steps: [
      { icon: '📖', title: 'Un article par jour', desc: 'Chaque jour, un nouvel article Wikipedia est sélectionné. Les mots sont masqués — à toi de les révéler.' },
      { icon: '💡', title: 'Devine mot par mot', desc: 'Tape un mot. S\'il apparaît dans l\'article, il se révèle partout. Les mots courants (le, de, un...) sont déjà visibles.' },
      { icon: '🎯', title: 'Trouve le titre', desc: 'Ton objectif : deviner tous les mots du titre de l\'article. Moins de tentatives = meilleur score !' },
    ],
    example: 'Exemple',
    exampleCaption: 'Le joueur a deviné "Marseille" — le mot se révèle partout dans le texte.',
    features: [
      { icon: '🔥', label: 'Streaks quotidiens' },
      { icon: '🏆', label: 'Classement global' },
      { icon: '📊', label: 'Statistiques perso' },
      { icon: '🌍', label: 'Français & Anglais' },
    ],
    cta: 'Commencer la partie du jour',
    noAccount: 'Pas besoin de compte pour jouer',
  },
  en: {
    subtitle: 'Every day, a Wikipedia article to guess.',
    subtitle2: 'Word by word. In as few attempts as possible.',
    play: 'Play',
    howToPlay: 'How to play',
    steps: [
      { icon: '📖', title: 'One article per day', desc: 'Every day, a new Wikipedia article is selected. Words are hidden — it\'s up to you to reveal them.' },
      { icon: '💡', title: 'Guess word by word', desc: 'Type a word. If it appears in the article, it gets revealed everywhere. Common words (the, a, of...) are already visible.' },
      { icon: '🎯', title: 'Find the title', desc: 'Your goal: guess all the words in the article\'s title. Fewer guesses = higher score!' },
    ],
    example: 'Example',
    exampleCaption: 'The player guessed "Marseille" — the word is revealed everywhere in the text.',
    features: [
      { icon: '🔥', label: 'Daily streaks' },
      { icon: '🏆', label: 'Global leaderboard' },
      { icon: '📊', label: 'Personal stats' },
      { icon: '🌍', label: 'French & English' },
    ],
    cta: 'Start today\'s game',
    noAccount: 'No account needed to play',
  },
}

export default function LandingPage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const [checking, setChecking] = useState(true)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        window.location.href = '/game'
        return
      }
      setChecking(false)
    })
  }, [])

  const t = translations[lang]

  if (checking) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }} />
  )

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Lang switch */}
      <div style={{ width: '100%', maxWidth: 680, padding: '16px 24px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['fr', 'en'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
              backgroundColor: lang === l ? 'var(--accent)' : 'transparent',
              color: lang === l ? 'white' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: '0.2s',
            }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Hero */}
      <div style={{
        width: '100%',
        maxWidth: 680,
        padding: '40px 24px 40px',
        textAlign: 'center',
      }}>
        <div style={{ marginBottom: 16 }}>
          <img src="/icon-192.png" alt="Wikifinder" width={80} height={80} style={{ borderRadius: '50%' }} />
        </div>
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 42,
          color: 'var(--text)',
          margin: '0 0 12px',
          lineHeight: 1.1,
        }}>
          Wikifinder
        </h1>
        <p style={{
          fontSize: 18,
          color: 'var(--text-muted)',
          margin: '0 0 32px',
          lineHeight: 1.5,
        }}>
          {t.subtitle}<br />
          {t.subtitle2}
        </p>
        <a href="/game" style={{
          display: 'inline-block',
          padding: '14px 36px',
          borderRadius: 10,
          backgroundColor: 'var(--accent)',
          color: 'white',
          fontSize: 17,
          fontWeight: 600,
          textDecoration: 'none',
          fontFamily: 'var(--font-sans)',
        }}>
          {t.play}
        </a>
      </div>

      {/* Comment jouer */}
      <div style={{
        width: '100%',
        maxWidth: 680,
        padding: '20px 24px 40px',
      }}>
        <h2 style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          textAlign: 'center',
          marginBottom: 24,
        }}>
          {t.howToPlay}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {t.steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: 16,
              padding: '20px 24px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              alignItems: 'flex-start',
            }}>
              <div style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{step.icon}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Démo visuelle */}
      <div style={{
        width: '100%',
        maxWidth: 680,
        padding: '0 24px 40px',
      }}>
        <div style={{
          padding: '24px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 12,
          }}>
            {t.example}
          </div>
          <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 2.4 }}>
            <span>{lang === 'fr' ? 'Le ' : 'The '}</span>
            <span style={{ backgroundColor: 'var(--masked)', borderRadius: 3, padding: '2px 12px' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span>{lang === 'fr' ? ' de ' : ' of '}</span>
            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Marseille</span>
            <span>{lang === 'fr' ? ' est une ' : ' is a '}</span>
            <span style={{ backgroundColor: 'var(--masked)', borderRadius: 3, padding: '2px 16px' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span>{lang === 'fr' ? ' du ' : ' of the '}</span>
            <span style={{ backgroundColor: 'var(--masked)', borderRadius: 3, padding: '2px 10px' }}>&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span>{lang === 'fr' ? ' de ' : ' of '}</span>
            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Marseille</span>
            <span>.</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, fontStyle: 'italic' }}>
            {t.exampleCaption}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{
        width: '100%',
        maxWidth: 680,
        padding: '0 24px 40px',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
      }}>
        {t.features.map((f, i) => (
          <div key={i} style={{
            padding: '16px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            textAlign: 'center',
            fontSize: 14,
            color: 'var(--text)',
            fontWeight: 500,
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
            {f.label}
          </div>
        ))}
      </div>

      {/* CTA final */}
      <div style={{ padding: '0 24px 60px', textAlign: 'center' }}>
        <a href="/game" style={{
          display: 'inline-block',
          padding: '14px 36px',
          borderRadius: 10,
          backgroundColor: 'var(--accent)',
          color: 'white',
          fontSize: 17,
          fontWeight: 600,
          textDecoration: 'none',
          fontFamily: 'var(--font-sans)',
        }}>
          {t.cta}
        </a>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
          {t.noAccount}
        </div>
      </div>

    </div>
  )
}
