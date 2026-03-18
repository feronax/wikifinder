'use client'

import { useState } from 'react'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleLogin() {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    if (res.ok) {
      window.location.href = '/admin'
    } else {
      setError('Mot de passe incorrect')
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 32, fontFamily: 'sans-serif' }}>
      <h1>Admin — Wikifinder</h1>
      <input
        type="password"
        placeholder="Mot de passe admin"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleLogin()}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box', marginBottom: 12 }}
      />
      {error && <div style={{ color: '#c62828', fontSize: 14, marginBottom: 12 }}>{error}</div>}
      <button
        onClick={handleLogin}
        style={{ width: '100%', padding: '10px 0', borderRadius: 6, backgroundColor: '#1a1a1a', color: 'white', border: 'none', cursor: 'pointer', fontSize: 15 }}
      >
        Se connecter
      </button>
    </div>
  )
}