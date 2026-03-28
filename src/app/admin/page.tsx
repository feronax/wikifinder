'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'

const ADMIN_KEY = 'wikifinder_admin'

export default function AdminPage() {
  const [auth, setAuth] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<any>(null)
  const [date, setDate] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0])
    setAuth(sessionStorage.getItem(ADMIN_KEY) === 'true')
    setMounted(true)
  }, [])

  async function seedDate() {
    setLoading(true)
    setMessage(null)
    const res = await fetch('/api/admin/seed-today', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': sessionStorage.getItem('wikifinder_pwd') || ''
      },
      body: JSON.stringify({ date })
    })
    const data = await res.json()
    setMessage(data)
    setLoading(false)
  }

  function handleAuth() {
    sessionStorage.setItem(ADMIN_KEY, 'true')
    sessionStorage.setItem('wikifinder_pwd', input)
    setAuth(true)
  }

  if (!mounted) return null

  if (!auth) return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header lang="fr" onLangChange={() => {}} onLogout={() => {}} />
      <div className="max-w-sm mx-auto mt-20 px-4">
        <div className="rounded-xl p-8" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text)' }}>
            Admin — Wikifinder
          </h1>
          <input
            type="password"
            placeholder="Mot de passe admin"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            className="w-full rounded-lg px-4 py-3 text-sm outline-none mb-3"
            style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
          />
          <button
            onClick={handleAuth}
            className="w-full py-3 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--accent)', fontFamily: 'var(--font-sans)' }}
          >
            Se connecter
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header lang="fr" onLangChange={() => {}} onLogout={() => {
        sessionStorage.removeItem(ADMIN_KEY)
        sessionStorage.removeItem('wikifinder_pwd')
        setAuth(false)
      }} />
      <div className="max-w-lg mx-auto mt-10 px-4">
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>
          Admin — Wikifinder
        </h1>

        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--text-muted)' }}>
            Générer une page
          </h2>
          <div className="flex gap-2 mb-4">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
            />
            <button
              onClick={seedDate}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--accent)', opacity: loading ? 0.6 : 1, fontFamily: 'var(--font-sans)' }}
            >
              {loading ? 'Génération...' : 'Générer'}
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-lg p-4 text-sm"
              style={{
                backgroundColor: message.success ? 'var(--revealed)' : 'rgba(229,62,62,0.1)',
                border: `1px solid ${message.success ? 'var(--accent)' : '#e53e3e'}`,
                color: 'var(--text)'
              }}>
              {message.success ? (
                <div className="space-y-1">
                  <div className="font-semibold mb-2" style={{ color: 'var(--accent)' }}>✓ Page générée</div>
                  <div style={{ color: 'var(--text-muted)' }}>📅 {message.date}</div>
                  <div style={{ color: 'var(--text-muted)' }}>🇫🇷 {message.title_fr}</div>
                  <div style={{ color: 'var(--text-muted)' }}>🇬🇧 {message.title_en}</div>
                  <div style={{ color: 'var(--text-muted)' }}>👁️ {message.pageviews?.toLocaleString()} vues</div>
                  <div style={{ color: 'var(--text-muted)' }}>📝 {message.word_count_fr?.toLocaleString()} mots</div>
                  {message.usedFallback && <div style={{ color: '#e59e3e' }}>⚠️ Fallback utilisé</div>}
                </div>
              ) : (
                <div style={{ color: '#e53e3e' }}>✗ {message.error}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}