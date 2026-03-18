'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'

type DailyEntry = {
  username: string
  guess_count: number
  duration_seconds: number
  lang: string
  date: string
}

type GlobalEntry = {
  username: string
  total_games: number
  avg_guesses: number
  best_score: number
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<'daily' | 'global'>('daily')
  const [daily, setDaily] = useState<DailyEntry[]>([])
  const [global, setGlobal] = useState<GlobalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadBoth()
  }, [])

  async function loadBoth() {
    setLoading(true)
    const [dailyRes, globalRes] = await Promise.all([
      fetch(`/api/leaderboard?type=daily&date=${today}`),
      fetch(`/api/leaderboard?type=global`)
    ])
    const dailyData = await dailyRes.json()
    const globalData = await globalRes.json()
    setDaily(dailyData.leaderboard || [])
    setGlobal(globalData.leaderboard || [])
    setLoading(false)
  }

  const tabStyle = (active: boolean) => ({
    padding: '8px 20px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontWeight: active ? '600' : '400',
    backgroundColor: active ? 'var(--accent)' : 'transparent',
    color: active ? 'white' : 'var(--text-muted)',
    fontSize: 14,
    transition: '0.2s',
  } as React.CSSProperties)

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

        <h1 style={{ margin: '0 0 24px 0', fontSize: 28, color: 'var(--text)' }}>Classement</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button style={tabStyle(tab === 'daily')} onClick={() => setTab('daily')}>
            Aujourd'hui
          </button>
          <button style={tabStyle(tab === 'global')} onClick={() => setTab('global')}>
            Global
          </button>
        </div>

        {/* Leaderboard quotidien */}
        {tab === 'daily' && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Meilleurs scores du {today} — classés par nombre de tentatives
            </div>
            {daily.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Aucun score pour aujourd'hui.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', width: 40, color: 'var(--text-muted)', fontWeight: 600 }}>#</th>
                    <th style={{ padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Joueur</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Tentatives</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Temps</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Langue</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((entry, i) => (
                    <tr key={i} style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: i === 0 ? 'var(--bg-secondary)' : 'transparent',
                    }}>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>{entry.username}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text)' }}>{entry.guess_count}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {entry.duration_seconds ? `${Math.floor(entry.duration_seconds / 60)}m${entry.duration_seconds % 60}s` : '-'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>{entry.lang.toUpperCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Leaderboard global */}
        {tab === 'global' && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Classement global — minimum 5 parties, trié par moyenne de tentatives
            </div>
            {global.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Aucun joueur avec 5 parties complétées pour l'instant.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', width: 40, color: 'var(--text-muted)', fontWeight: 600 }}>#</th>
                    <th style={{ padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Joueur</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Parties</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Moyenne</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Meilleur</th>
                  </tr>
                </thead>
                <tbody>
                  {global.map((entry, i) => (
                    <tr key={i} style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: i === 0 ? 'var(--bg-secondary)' : 'transparent',
                    }}>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>{entry.username}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text)' }}>{entry.total_games}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text)' }}>{entry.avg_guesses}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text)' }}>{entry.best_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}