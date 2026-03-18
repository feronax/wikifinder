'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [user, setUser] = useState<any>(null)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  if (!user) return null

  async function handleSubmit() {
    if (!message.trim()) return
    setLoading(true)

    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    })

    if (res.ok) {
      setSent(true)
      setMessage('')
      setTimeout(() => {
        setSent(false)
        setOpen(false)
      }, 2000)
    }
    setLoading(false)
  }

  return (
    <>
      {/* Overlay pour fermer */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
        />
      )}

      {/* Aside panel */}
      <div style={{
        position: 'fixed',
        bottom: 80,
        right: open ? 0 : -420,
        width: 360,
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRight: 'none',
        borderRadius: '12px 0 0 12px',
        boxShadow: 'var(--shadow-lg)',
        padding: 24,
        zIndex: 50,
        transition: 'right 0.3s ease',
        fontFamily: 'var(--font-sans)',
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: 'var(--text)' }}>
          Signaler un problème
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Un bug, une page bizarre, une suggestion ? Dis-nous tout.
        </p>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--accent)', fontWeight: 'bold' }}>
            ✓ Merci pour ton retour !
          </div>
        ) : (
          <>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Décris le problème..."
              rows={4}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                fontSize: 14,
                resize: 'vertical',
                boxSizing: 'border-box',
                marginBottom: 12,
                fontFamily: 'var(--font-sans)',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !message.trim()}
              style={{
                width: '100%',
                padding: '10px 0',
                borderRadius: 6,
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                cursor: loading || !message.trim() ? 'default' : 'pointer',
                fontSize: 14,
                fontWeight: '600',
                fontFamily: 'var(--font-sans)',
                opacity: loading || !message.trim() ? 0.6 : 1,
              }}
            >
              {loading ? 'Envoi...' : 'Envoyer'}
            </button>
          </>
        )}
      </div>

      {/* Bouton flottant avec languette */}
      <div
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 50,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Languette animée */}
        <div style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          fontSize: 12,
          fontWeight: 600,
          padding: '6px 10px',
          borderRadius: 6,
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateX(0)' : 'translateX(8px)',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: 'var(--shadow)',
          fontFamily: 'var(--font-sans)',
        }}>
          Signaler un problème
        </div>

        {/* Bouton rond */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          boxShadow: 'var(--shadow)',
          transform: hovered ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.2s ease',
        }}>
          💬
        </div>
      </div>
    </>
  )
}