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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<'daily' | 'global'>('daily')
  const [daily, setDaily] = useState<DailyEntry[]>([])
  const [global, setGlobal] = useState<GlobalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()
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
    flex: isMobile ? 1 : 'none',
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
      <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '24px 16px' : '32px 20px' }}>

        <h1 style={{ margin: '0 0 24px 0', fontSize: 28, color: 'var(--text)' }}>Classement</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button style={tabStyle(tab === 'daily')} onClick={() => setTab('daily')}>Aujourd'hui</button>
          <button style={tabStyle(tab === 'global')} onClick={() => setTab('global')}>Global</button>
        </div>

        {/* --- CONTENU DU CLASSEMENT --- */}
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            {tab === 'daily' ? `Meilleurs scores du ${today}` : "Top joueurs (min. 5 parties)"}
          </div>

          {(tab === 'daily' ? daily : global).length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Aucun score disponible.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              {/* En-tête (Uniquement sur Desktop) */}
              {!isMobile && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: tab === 'daily' ? '50px 1fr 100px 100px 80px' : '50px 1fr 80px 80px 80px',
                  padding: '0 12px 8px 12px',
                  borderBottom: '2px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: 13
                }}>
                  <span>#</span>
                  <span>Joueur</span>
                  <span style={{ textAlign: 'center' }}>{tab === 'daily' ? 'Essais' : 'Parties'}</span>
                  <span style={{ textAlign: 'center' }}>{tab === 'daily' ? 'Temps' : 'Moyenne'}</span>
                  <span style={{ textAlign: 'center' }}>{tab === 'daily' ? 'Langue' : 'Best'}</span>
                </div>
              )}

              {/* Lignes de données */}
              {(tab === 'daily' ? daily : global).map((entry: any, i) => (
                <div key={i} style={{
                  display: isMobile ? 'flex' : 'grid',
                  gridTemplateColumns: tab === 'daily' ? '50px 1fr 100px 100px 80px' : '50px 1fr 80px 80px 80px',
                  flexDirection: 'column',
                  padding: '12px',
                  backgroundColor: 'var(--surface)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  position: 'relative'
                }}>
                  
                  {/* Rang (Badge sur mobile, colonne sur desktop) */}
                  <div style={{ 
                    fontWeight: 'bold', 
                    fontSize: isMobile ? 18 : 16,
                    marginBottom: isMobile ? 8 : 0,
                    color: i < 3 ? 'var(--accent)' : 'var(--text)'
                  }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>

                  {/* Nom du joueur */}
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>
                    {entry.username}
                  </div>

                  {/* Statistiques adaptatives */}
                  {isMobile ? (
                    // Layout Mobile : Infos en ligne sous le pseudo
                    <div style={{ 
                        display: 'flex', 
                        gap: '15px', 
                        marginTop: '8px', 
                        fontSize: '13px', 
                        color: 'var(--text-muted)',
                        width: '100%',
                        borderTop: '1px solid var(--border)',
                        paddingTop: '8px'
                    }}>
                      <div>
                        <strong>{tab === 'daily' ? 'Essais' : 'Parties'}:</strong> {tab === 'daily' ? entry.guess_count : entry.total_games}
                      </div>
                      <div>
                        <strong>{tab === 'daily' ? 'Temps' : 'Moy'}:</strong> {tab === 'daily' ? (entry.duration_seconds ? `${Math.floor(entry.duration_seconds / 60)}m` : '-') : entry.avg_guesses}
                      </div>
                      {tab === 'global' && (
                        <div><strong>Best:</strong> {entry.best_score}</div>
                      )}
                    </div>
                  ) : (
                    // Layout Desktop : Colonnes alignées
                    <>
                      <div style={{ textAlign: 'center', color: 'var(--text)' }}>
                        {tab === 'daily' ? entry.guess_count : entry.total_games}
                      </div>
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        {tab === 'daily' ? (entry.duration_seconds ? `${Math.floor(entry.duration_seconds / 60)}m${entry.duration_seconds % 60}s` : '-') : entry.avg_guesses}
                      </div>
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        {tab === 'daily' ? entry.lang.toUpperCase() : entry.best_score}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}