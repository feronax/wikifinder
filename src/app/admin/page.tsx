'use client'

import { useState, useEffect } from 'react'

const ADMIN_KEY = 'wikifinder_admin'

export default function AdminPage() {
  const [auth, setAuth] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [date, setDate] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0])
    setAuth(sessionStorage.getItem(ADMIN_KEY) === 'true')
    setMounted(true)
  }, [])

  async function seedDate() {
    setLoading(true)
    setMessage('')
    const res = await fetch('/api/admin/seed-today', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': input || sessionStorage.getItem('wikifinder_pwd') || ''
      },
      body: JSON.stringify({ date })
    })
    const data = await res.json()
    setMessage(JSON.stringify(data, null, 2))
    setLoading(false)
  }

  function handleAuth() {
    sessionStorage.setItem(ADMIN_KEY, 'true')
    sessionStorage.setItem('wikifinder_pwd', input)
    setAuth(true)
  }

  if (!mounted) return null

  if (!auth) return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 32, fontFamily: 'sans-serif' }}>
      <h1>Admin — Wikifinder</h1>
      <input
        type="password"
        placeholder="Mot de passe admin"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAuth()}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box', marginBottom: 12 }}
      />
      <button onClick={handleAuth} style={{ width: '100%', padding: '10px 0', borderRadius: 6, backgroundColor: '#1a1a1a', color: 'white', border: 'none', cursor: 'pointer', fontSize: 15 }}>
        Se connecter
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 32, fontFamily: 'sans-serif' }}>
      <h1>Admin — Wikifinder</h1>
      <div style={{ marginBottom: 32, padding: 24, border: '1px solid #e0e0e0', borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Générer une page</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 15 }}
          />
          <button onClick={seedDate} disabled={loading} style={{ padding: '8px 20px', borderRadius: 6, backgroundColor: '#1a1a1a', color: 'white', border: 'none', cursor: 'pointer', fontSize: 15 }}>
            {loading ? 'Génération...' : 'Générer'}
          </button>
        </div>
        {message && (
          <pre style={{ backgroundColor: '#f5f5f5', padding: 12, borderRadius: 6, fontSize: 13, overflow: 'auto' }}>
            {message}
          </pre>
        )}
      </div>
    </div>
  )
}