'use client'

import React from 'react'

type DuelCardState = 'idle' | 'waiting' | 'your-turn' | 'ready' | 'anon'

interface DuelCardProps {
  state: DuelCardState
  expiresAt?: string
  lang: 'fr' | 'en'
  onPrimary: () => void
}

function formatRelative(iso: string, lang: 'fr' | 'en'): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  if (diffMs <= 0) return lang === 'fr' ? 'expiré' : 'expired'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)} h`
}

export default function DuelCard({ state, expiresAt, lang, onPrimary }: DuelCardProps) {
  const active = state !== 'idle' && state !== 'anon'

  const copy = {
    idle: lang === 'fr'
      ? { heading: 'Défie un ami', subtitle: 'Partage un lien pour jouer l\'article du jour en duel.', cta: 'Créer un duel' }
      : { heading: 'Challenge a friend', subtitle: 'Share a link to play today\'s article head-to-head.', cta: 'Create a duel' },
    waiting: lang === 'fr'
      ? { heading: 'En attente de ton ami', subtitle: 'Tu as terminé. En attente du second joueur.', cta: 'Voir le duel' }
      : { heading: 'Waiting for your friend', subtitle: 'You\'re done. Waiting for the other player.', cta: 'View duel' },
    'your-turn': lang === 'fr'
      ? { heading: 'À toi de jouer', subtitle: 'Ton ami a terminé — à toi de finir le duel.', cta: 'Jouer le duel' }
      : { heading: 'Your turn', subtitle: 'Your friend finished — your move.', cta: 'Play the duel' },
    ready: lang === 'fr'
      ? { heading: 'Résultat prêt', subtitle: 'Votre duel est terminé.', cta: 'Voir le résultat' }
      : { heading: 'Result ready', subtitle: 'Your duel is complete.', cta: 'View result' },
    anon: lang === 'fr'
      ? { heading: 'Défie un ami', subtitle: 'Connecte-toi pour créer un duel.', cta: 'Se connecter pour défier un ami' }
      : { heading: 'Challenge a friend', subtitle: 'Sign in to challenge a friend.', cta: 'Sign in to challenge a friend' },
  }
  const t = copy[state]

  const card: React.CSSProperties = {
    padding: 24,
    borderRadius: 12,
    border: '1px solid var(--border)',
    backgroundColor: active ? 'var(--bg-secondary)' : 'var(--surface)',
    borderLeft: active ? '3px solid var(--accent)' : '1px solid var(--border)',
    marginBottom: 16,
  }
  const eyebrow: React.CSSProperties = {
    fontSize: 14, fontWeight: 500, color: 'var(--accent)',
    letterSpacing: '0.08em', textTransform: 'uppercase',
  }
  const heading: React.CSSProperties = {
    fontSize: 20, fontWeight: 600, color: 'var(--text)',
    margin: '8px 0', lineHeight: 1.2,
  }
  const subtitle: React.CSSProperties = {
    fontSize: 16, fontWeight: 400, color: 'var(--text-muted)',
    lineHeight: 1.5, marginBottom: 16,
  }
  const cta: React.CSSProperties = {
    width: '100%', padding: '12px 20px', minHeight: 44, borderRadius: 8, border: 'none',
    backgroundColor: 'var(--accent)', color: 'white', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
  }

  return (
    <section aria-labelledby="duel-heading" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={eyebrow}>{lang === 'fr' ? 'DUEL' : 'DUEL'}</div>
        {active && expiresAt && (
          <div
            role="status"
            aria-label={`${lang === 'fr' ? 'Expire dans' : 'Expires in'} ${formatRelative(expiresAt, lang)}`}
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}
          >
            {formatRelative(expiresAt, lang)}
          </div>
        )}
      </div>
      <h2 id="duel-heading" style={heading}>{t.heading}</h2>
      <div style={subtitle}>{t.subtitle}</div>
      <button type="button" onClick={onPrimary} style={cta}>{t.cta}</button>
    </section>
  )
}
