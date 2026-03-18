'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

type GameEntry = {
  id: string
  date: string
  lang: string
  guess_count: number
  completed: boolean
  completed_at: string | null
  pages: {
    wikipedia_title_fr: string
    wikipedia_title_en: string
  }
}

export default function HistoryPage() {
  const [games, setGames] = useState<GameEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.href = '/auth/login'
        return
      }
      setUser(data.user)
      loadHistory()
    })
  }, [])

async function loadHistory() {
    const res = await fetch('/api/history')
    if (!res.ok) {
      setLoading(false)
      return
    }
    const data = await res.json()
    setGames(data.games || [])
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 40 }}>Chargement...</div>

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Historique</h1>
        <a href="/game" style={{ color: '#1a1a1a', textDecoration: 'none', fontWeight: 'bold' }}>← Jouer</a>
      </div>

      {games.length === 0 ? (
        <p style={{ color: '#666' }}>Aucune partie jouée pour l'instant.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {games.map(game => {
            const page = game.pages as any
            const title = game.lang === 'fr' ? page?.wikipedia_title_fr : page?.wikipedia_title_en
            return (
              <div key={game.id} style={{
                padding: 16, borderRadius: 8, border: '1px solid #e0e0e0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{page?.date}</div>
                  <div style={{ color: '#666', fontSize: 14 }}>
                    {game.completed ? title : '???'} — {game.lang.toUpperCase()}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, color: '#666' }}>{game.guess_count} tentatives</span>
                  {game.completed ? (
                    <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✓ Trouvé</span>
                  ) : (
                    <a href={`/game?date=${page?.date}&lang=${game.lang}`}
                      style={{ color: '#1565c0', fontWeight: 'bold', textDecoration: 'none', fontSize: 14 }}>
                      Reprendre →
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}