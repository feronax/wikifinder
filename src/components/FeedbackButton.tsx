'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [user, setUser] = useState<any>(null)
  const isMobile = useIsMobile()
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  if (!user) return null

  async function handleSubmit() {
    if (!message.trim() || message.trim().length < 30) return
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

  const charCount = message.trim().length
  const isValid = charCount >= 30

  return (
    <>
      {/* Overlay pour fermer */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
        />
      )}

      {/* Panel — s'adapte à tous les écrans */}
      {open && (
        <div style={{
          position: 'fixed',
          zIndex: 50,
          fontFamily: 'var(--font-sans)',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg)',
          padding: 24,
          bottom: 84,
          right: 16,
          width: 'min(360px, calc(100vw - 32px))',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>
              Signaler un problème
            </h3>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
                padding: '0 4px', fontFamily: 'var(--font-sans)',
              }}
            >
              ✕
            </button>
          </div>

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
                  marginBottom: 6,
                  fontFamily: 'var(--font-sans)',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
              />
              <div style={{
                fontSize: 12,
                marginBottom: 12,
                textAlign: 'right',
                color: isValid ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                {charCount} / 30 min
              </div>
              <button
                onClick={handleSubmit}
                disabled={loading || !isValid}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  borderRadius: 6,
                  backgroundColor: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  cursor: loading || !isValid ? 'default' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  opacity: loading || !isValid ? 0.6 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {loading ? 'Envoi...' : 'Envoyer'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Bouton flottant */}
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
        {/* Languette — desktop uniquement, masquée quand panel ouvert */}
        {!isMobile && (
          <div style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 10px',
            borderRadius: 6,
            opacity: hovered && !open ? 1 : 0,
            transform: hovered && !open ? 'translateX(0)' : 'translateX(8px)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: 'var(--shadow)',
            fontFamily: 'var(--font-sans)',
          }}>
            Signaler un problème
          </div>
        )}

        {/* Bouton rond */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          backgroundColor: open ? 'var(--accent)' : 'var(--surface)',
          border: '1px solid var(--border)',
          color: open ? 'white' : 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          boxShadow: 'var(--shadow)',
          transform: hovered ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.2s ease, background-color 0.2s ease',
        }}>
          💬
        </div>
      </div>
    </>
  )
}