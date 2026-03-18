'use client'

import { useState } from 'react'

export default function AdminPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  async function seedDate() {
    setLoading(true)
    setMessage('')
    const res = await fetch('/api/admin/seed-today', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date })
    })
    const data = await res.json()
    setMessage(JSON.stringify(data, null, 2))
    setLoading(false)
  }

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
          <button
            onClick={seedDate}
            disabled={loading}
            style={{ padding: '8px 20px', borderRadius: 6, backgroundColor: '#1a1a1a', color: 'white', border: 'none', cursor: 'pointer', fontSize: 15 }}
          >
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