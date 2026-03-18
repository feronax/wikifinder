'use client'

import { useEffect, useState } from 'react'

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
    border: 'none',
    cursor: 'pointer',
    fontWeight: active ? 'bold' : 'normal',
    backgroundColor: active ? '#1a1a1a' : '#f0f0f0',
    color: active ? 'white' : '#333',
    fontSize: 14,
  } as React.CSSProperties)

  if (loading) return <div style={{ padding: 40 }}>Chargement...</div>

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Classement</h1>
        <a href="/game" style={{ color: '#1a1a1a', textDecoration: 'none', fontWeight: 'bold' }}>← Jouer</a>
      </div>

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
          <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            Meilleurs scores du {today} — classés par nombre de tentatives
          </div>
          {daily.length === 0 ? (
            <p style={{ color: '#666' }}>Aucun score pour aujourd'hui.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', width: 40 }}>#</th>
                  <th style={{ padding: '8px 12px' }}>Joueur</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Tentatives</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Temps</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Langue</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((entry, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: i === 0 ? '#fffde7' : 'white' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#333' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{entry.username}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{entry.guess_count}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#666' }}>
                      {entry.duration_seconds ? `${Math.floor(entry.duration_seconds / 60)}m${entry.duration_seconds % 60}s` : '-'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{entry.lang.toUpperCase()}</td>
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
          <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            Classement global — minimum 5 parties, trié par moyenne de tentatives
          </div>
          {global.length === 0 ? (
            <p style={{ color: '#666' }}>Aucun joueur avec 5 parties complétées pour l'instant.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', width: 40 }}>#</th>
                  <th style={{ padding: '8px 12px' }}>Joueur</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Parties</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Moyenne</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Meilleur</th>
                </tr>
              </thead>
              <tbody>
                {global.map((entry, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: i === 0 ? '#fffde7' : 'white' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{entry.username}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{entry.total_games}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{entry.avg_guesses}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{entry.best_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}