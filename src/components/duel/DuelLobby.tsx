'use client'

import React from 'react'

type LobbySub = 'authed-match' | 'lang-mismatch' | 'self-duel' | 'anon'

interface DuelLobbyProps {
  sub: LobbySub
  creatorUsername: string
  roomLang: 'fr' | 'en'
  expiresAt: string
  lang: 'fr' | 'en'
  duelId: string
  onStart: () => void
  onSwitchLang: () => void
  onCancel: () => void
  onShareLink: () => void
  onSignIn: () => void
}

function formatRelativeTime(iso: string, lang: 'fr' | 'en'): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  if (diffMs <= 0) return lang === 'fr' ? 'expiré' : 'expired'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return lang === 'fr' ? `${mins} min` : `${mins} min`
  const hours = Math.floor(mins / 60)
  return lang === 'fr' ? `${hours} h` : `${hours} h`
}

export default function DuelLobby({
  sub, creatorUsername, roomLang, expiresAt, lang,
  onStart, onSwitchLang, onCancel, onShareLink, onSignIn,
}: DuelLobbyProps) {
  const t = lang === 'fr'
    ? {
        heading: sub === 'self-duel' ? 'C\'est ton duel' : 'On t\'a défié !',
        body: sub === 'self-duel'
          ? 'Tu as créé ce duel — partage-le avec un ami.'
          : `${creatorUsername} t'a invité à jouer sur l'article du jour.`,
        langLabel: 'Langue :',
        expires: 'Expire dans',
        start: 'Démarrer le duel',
        signIn: 'Se connecter pour jouer',
        share: 'Partager le lien',
        switchJoin: `Passer en ${roomLang.toUpperCase()} et rejoindre`,
        cancel: 'Annuler',
        mismatchBody: `Ce duel est en ${roomLang.toUpperCase()} / ton app est en ${lang.toUpperCase()}.`,
      }
    : {
        heading: sub === 'self-duel' ? 'This is your duel' : 'You\'ve been challenged!',
        body: sub === 'self-duel'
          ? 'You created this duel — share it with a friend so they can join.'
          : `${creatorUsername} has invited you to play today's article.`,
        langLabel: 'Language:',
        expires: 'Expires in',
        start: 'Start duel',
        signIn: 'Sign in to join',
        share: 'Share the link',
        switchJoin: `Switch to ${roomLang.toUpperCase()} and join`,
        cancel: 'Cancel',
        mismatchBody: `This duel is in ${roomLang.toUpperCase()} / your app is set to ${lang.toUpperCase()}.`,
      }

  const card: React.CSSProperties = {
    maxWidth: 480, margin: '0 auto',
    padding: 32, backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)',
  }
  const h: React.CSSProperties = {
    fontFamily: "'DM Serif Display', serif", fontSize: 24, color: 'var(--text)', margin: '0 0 12px',
  }
  const meta: React.CSSProperties = {
    fontSize: 13, color: 'var(--text-muted)', marginTop: 16, marginBottom: 16,
    display: 'flex', gap: 12, flexWrap: 'wrap',
  }
  const accentBtn: React.CSSProperties = {
    width: '100%', padding: '12px 20px', minHeight: 44, borderRadius: 8, border: 'none',
    backgroundColor: 'var(--accent)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  }
  const ghostBtn: React.CSSProperties = {
    width: '100%', padding: '12px 20px', minHeight: 44, borderRadius: 8,
    border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-muted)',
    fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginTop: 8,
  }

  return (
    <section aria-labelledby="lobby-heading" style={card}>
      <h1 id="lobby-heading" style={h}>{t.heading}</h1>
      <div style={{ color: 'var(--text)', fontSize: 15, lineHeight: 1.5 }}>{t.body}</div>
      <div style={meta}>
        <span>{t.langLabel} {roomLang.toUpperCase()}</span>
        <span>· {t.expires} {formatRelativeTime(expiresAt, lang)}</span>
      </div>
      <div aria-live="polite">
        {sub === 'lang-mismatch' && (
          <>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
              {t.mismatchBody}
            </div>
            <button type="button" onClick={onSwitchLang} style={accentBtn}>{t.switchJoin}</button>
            <button type="button" onClick={onCancel} style={ghostBtn}>{t.cancel}</button>
          </>
        )}
        {sub === 'authed-match' && (
          <button type="button" onClick={onStart} style={accentBtn}>{t.start}</button>
        )}
        {sub === 'anon' && (
          <button type="button" onClick={onSignIn} style={accentBtn}>{t.signIn}</button>
        )}
        {sub === 'self-duel' && (
          <button type="button" onClick={onShareLink} style={accentBtn}>{t.share}</button>
        )}
      </div>
    </section>
  )
}
