'use client'

import React from 'react'

interface DuelPrivatePanelProps {
  lang: 'fr' | 'en'
  onPlayToday: () => void
}

export default function DuelPrivatePanel({ lang, onPlayToday }: DuelPrivatePanelProps) {
  const t = lang === 'fr'
    ? {
        heading: 'Ce duel est privé',
        body: 'Seuls les deux participants peuvent voir le résultat.',
        cta: 'Jouer l\'article du jour',
      }
    : {
        heading: 'This duel is private',
        body: 'Only the two participants can see this duel\'s result.',
        cta: "Play today's article",
      }

  return (
    <section
      aria-labelledby="private-heading"
      style={{
        maxWidth: 480, margin: '0 auto',
        padding: 32, backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)',
      }}
    >
      <h1
        id="private-heading"
        style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: 'var(--text)', margin: '0 0 12px' }}
      >
        {t.heading}
      </h1>
      <div style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.5, marginBottom: 24 }}>
        {t.body}
      </div>
      <button
        type="button"
        onClick={onPlayToday}
        style={{
          width: '100%', padding: '12px 20px', minHeight: 44, borderRadius: 8, border: 'none',
          backgroundColor: 'var(--accent)', color: 'white',
          fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}
      >
        {t.cta}
      </button>
    </section>
  )
}
