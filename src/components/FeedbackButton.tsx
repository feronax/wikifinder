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

  // Uniquement visible pour les connectés
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
        backgroundColor: 'white',
        borderRadius: '12px 0 0 12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        padding: 24,
        zIndex: 50,
        transition: 'right 0.3s ease',
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Signaler un problème</h3>
        <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#666' }}>
          Un bug, une page bizarre, une suggestion ? Dis-nous tout.
        </p>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#2e7d32', fontWeight: 'bold' }}>
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
                border: '1px solid #ccc',
                fontSize: 14,
                resize: 'vertical',
                boxSizing: 'border-box',
                marginBottom: 12,
                fontFamily: 'sans-serif',
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !message.trim()}
              style={{
                width: '100%',
                padding: '10px 0',
                borderRadius: 6,
                backgroundColor: '#1a1a1a',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 'bold',
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
          backgroundColor: '#1a1a1a',
          color: 'white',
          fontSize: 12,
          fontWeight: 'bold',
          padding: '6px 10px',
          borderRadius: 6,
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateX(0)' : 'translateX(8px)',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          Signaler un problème
        </div>

        {/* Bouton rond */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          backgroundColor: '#1a1a1a',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
          transform: hovered ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.2s ease',
        }}>
          💬
        </div>
      </div>
    </>
  )
}