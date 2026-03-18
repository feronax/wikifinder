'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import Header from '@/components/Header'

type HistoryEntry = {
  page_id: string
  date: string
  wikipedia_title_fr: string
  wikipedia_title_en: string
  game: {
    id: string
    lang: string
    guess_count: number
    completed: boolean
  } | null
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.href = '/auth/login'
        return
      }
      loadHistory()
    })
  }, [])

  async function loadHistory() {
    const res = await fetch('/api/history')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setHistory(data.history || [])
    setLoading(false)
  }

  const today = new Date().toISOString().split('T')[0]

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

        {history.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Aucune page disponible pour l&apos;instant.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map(entry => {
              const title = lang === 'fr' ? entry.wikipedia_title_fr : entry.wikipedia_title_en
              const isToday = entry.date === today
              const game = entry.game
              const completed = game?.completed
              const notStarted = !game
              const gameUrl = '/game?date=' + entry.date + '&lang=' + lang

              return (
                <div key={entry.page_id} style={{
                  padding: '16px 20px',
                  borderRadius: 10,
                  border: '1px solid ' + (isToday ? 'var(--accent)' : 'var(--border)'),
                  backgroundColor: 'var(--surface)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  opacity: notStarted ? 0.7 : 1,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: isToday ? 'var(--accent)' : 'var(--text-muted)', marginBottom: 4 }}>
                      {entry.date}{isToday ? " — Aujourd'hui" : ''}
                    </div>
                    <div style={{ color: 'var(--text)', fontSize: 15 }}>
                      {completed
                        ? <span style={{ fontWeight: 500 }}>{title}</span>
                        : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            {notStarted ? 'Non commencée' : 'En cours...'}
                          </span>
                      }
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {game && (
                      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        {game.guess_count} tentative{game.guess_count > 1 ? 's' : ''}
                      </span>
                    )}
                    <a
                      href={gameUrl}
                      style={{
                        color: 'var(--accent)',
                        fontWeight: 600,
                        textDecoration: 'none',
                        fontSize: 14,
                        padding: '4px 10px',
                        borderRadius: 20,
                        border: '1px solid var(--accent)',
                      }}
                    >
                      {completed ? '✓ Revoir →' : notStarted ? 'Jouer →' : 'Reprendre →'}
                    </a>
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