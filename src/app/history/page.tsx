'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { calculateScore } from '@/lib/utils'
import Header from '@/components/Header'
import Loader from '@/components/Loader'

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
  const [loadingMore, setLoadingMore] = useState(false)
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.href = '/auth/login'
        return
      }
      loadHistory(1)
    })
  }, [])

  async function loadHistory(p: number) {
    if (p === 1) setLoading(true)
    else setLoadingMore(true)

    const res = await fetch(`/api/history?page=${p}`)
    if (!res.ok) { setLoading(false); setLoadingMore(false); return }
    const data = await res.json()

    if (p === 1) {
      setHistory(data.history || [])
    } else {
      setHistory(prev => [...prev, ...(data.history || [])])
    }
    setPage(data.page)
    setTotalPages(data.totalPages)
    setLoading(false)
    setLoadingMore(false)
  }

  const today = new Date().toISOString().split('T')[0]

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px' }}>
        <div className="skeleton" style={{ width: 180, height: 28, marginBottom: 24 }} />
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton" style={{ width: '100%', height: 72, borderRadius: 10, marginBottom: 10 }} />
        ))}
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
              const score = game ? calculateScore(game.guess_count, !!completed) : null

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
                  <div style={{ flex: 1, minWidth: 0 }}>
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
                    {game && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                        {game.guess_count} tentative{game.guess_count > 1 ? 's' : ''}
                        {completed && score !== null && (
                          <span style={{ marginLeft: 10, color: 'var(--accent)', fontWeight: 600 }}>
                            {score.toLocaleString()} pts
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ flexShrink: 0 }}>
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
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {completed ? 'Revoir' : notStarted ? 'Jouer' : 'Reprendre'}
                    </a>
                  </div>
                </div>
              )
            })}

            {page < totalPages && (
              <button
                onClick={() => loadHistory(page + 1)}
                disabled={loadingMore}
                style={{
                  padding: '12px 24px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: loadingMore ? 'default' : 'pointer',
                  opacity: loadingMore ? 0.6 : 1,
                  fontFamily: 'var(--font-sans)',
                  marginTop: 8,
                }}
              >
                {loadingMore ? 'Chargement...' : 'Voir plus'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
