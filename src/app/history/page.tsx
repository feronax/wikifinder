'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import Header from '@/components/Header'

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

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        Chargement...
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px' }}>

        <h1 style={{ margin: '0 0 24px 0', fontSize: 28, color: 'var(--text)' }}>Historique</h1>

        {games.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Aucune partie jouée pour l'instant.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {games.map(game => {
              const page = game.pages as any
              const title = game.lang === 'fr' ? page?.wikipedia_title_fr : page?.wikipedia_title_en
              return (
                <div key={game.id} style={{
                  padding: '16px 20px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {page?.date}
                    </div>
                    <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: game.completed ? 500 : 400 }}>
                      {game.completed ? title : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non terminée</span>}
                      <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {game.lang}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                      {game.guess_count} tentative{game.guess_count > 1 ? 's' : ''}
                    </span>
                    {game.completed ? (
                      <span style={{
                        color: 'var(--accent)',
                        fontWeight: 600,
                        fontSize: 14,
                        padding: '4px 10px',
                        borderRadius: 20,
                        border: '1px solid var(--accent)',
                      }}>
                        ✓ Trouvé
                      </span>
                    ) : (
                      <a href={`/game?date=${page?.date}&lang=${game.lang}`} style={{
                        color: 'var(--accent)',
                        fontWeight: 600,
                        textDecoration: 'none',
                        fontSize: 14,
                        padding: '4px 10px',
                        borderRadius: 20,
                        border: '1px solid var(--accent)',
                      }}>
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
    </div>
  )
}