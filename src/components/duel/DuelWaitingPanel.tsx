'use client'

import React from 'react'

interface DuelWaitingPanelProps {
  opponentUsername: string
  expiresAt: string
  lang: 'fr' | 'en'
  onRefresh: () => void
  onShareLink: () => void
}

function formatRelative(iso: string, lang: 'fr' | 'en'): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  if (diffMs <= 0) return lang === 'fr' ? 'expiré' : 'expired'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)} h`
}

export default function DuelWaitingPanel({
  opponentUsername, expiresAt, lang, onRefresh, onShareLink,
}: DuelWaitingPanelProps) {
  const t = lang === 'fr'
    ? {
        heading: 'En attente de ton ami',
        body: `Ton score est enregistré. ${opponentUsername} doit encore terminer.`,
        expires: 'Expire dans',
        refresh: 'Actualiser',
        share: 'Repartager le lien',
      }
    : {
        heading: 'Waiting for your friend',
        body: `Your score is locked in. ${opponentUsername} hasn't finished yet.`,
        expires: 'Expires in',
        refresh: 'Refresh',
        share: 'Share the link again',
      }

  const card: React.CSSProperties = {
    maxWidth: 480, margin: '0 auto',
    padding: 32, backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)',
  }
  const h: React.CSSProperties = {
    fontFamily: "'DM Serif Display', serif", fontSize: 24, color: 'var(--text)', margin: '0 0 12px',
  }
  const outline: React.CSSProperties = {
    flex: 1, padding: '12px 20px', minHeight: 44, borderRadius: 8,
    border: '1px solid var(--accent)', backgroundColor: 'transparent', color: 'var(--accent)',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
  }
  const accent: React.CSSProperties = {
    flex: 1, padding: '12px 20px', minHeight: 44, borderRadius: 8, border: 'none',
    backgroundColor: 'var(--accent)', color: 'white',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
  }

  return (
    <section aria-labelledby="waiting-heading" style={card}>
      <h1 id="waiting-heading" style={h}>{t.heading}</h1>
      <div style={{ color: 'var(--text)', fontSize: 15, lineHeight: 1.5 }}>{t.body}</div>
      <div
        role="status"
        aria-label={`${t.expires} ${formatRelative(expiresAt, lang)}`}
        style={{ fontSize: 13, color: 'var(--text-muted)', margin: '16px 0 24px' }}
      >
        {t.expires} {formatRelative(expiresAt, lang)}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" onClick={onRefresh} style={outline}>{t.refresh}</button>
        <button type="button" onClick={onShareLink} style={accent}>{t.share}</button>
      </div>
    </section>
  )
}
