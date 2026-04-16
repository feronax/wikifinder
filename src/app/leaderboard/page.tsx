'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/lib/utils'
import Header from '@/components/Header'
import Loader from '@/components/Loader'

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
  // Le champ est en cours de renommage côté DB : on lit `best_guesses` si
  // présent, sinon on retombe sur l'ancien `best_score` (tolère les deux
  // états pendant la transition — cf. SQL de migration dans le README).
  best_guesses?: number
  best_score?: number
}

type SeasonEntry = {
  position: number
  username: string
  favorite_badge: string | null
  total_score: number
  total_time_seconds: number
  games_played: number
  rank: string
}

type SeasonInfo = {
  id: number
  name: string
  starts_at: string
  ends_at: string
}

const RANK_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#40E0D0',
  diamond: '#B9F2FF',
}

const RANK_NAMES: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Argent',
  gold: 'Or',
  platinum: 'Platine',
  diamond: 'Diamant',
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<'daily' | 'global' | 'season'>('daily')
  const [daily, setDaily] = useState<DailyEntry[]>([])
  const [global, setGlobal] = useState<GlobalEntry[]>([])
  const [season, setSeason] = useState<SeasonEntry[]>([])
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [dailyRes, globalRes, seasonRes] = await Promise.all([
      fetch(`/api/leaderboard?type=daily&date=${today}`),
      fetch(`/api/leaderboard?type=global`),
      fetch('/api/season'),
    ])
    const dailyData = await dailyRes.json()
    const globalData = await globalRes.json()
    setDaily(dailyData.leaderboard || [])
    setGlobal(globalData.leaderboard || [])
    if (seasonRes.ok) {
      const seasonData = await seasonRes.json()
      setSeason(seasonData.leaderboard || [])
      setSeasonInfo(seasonData.season || null)
    }
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
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px' }}>
        <div className="skeleton" style={{ width: 200, height: 28, marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <div className="skeleton" style={{ width: 100, height: 36, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 80, height: 36, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 80, height: 36, borderRadius: 6 }} />
        </div>
        {[1,2,3,4,5].map(i => (
          <div key={i} className="skeleton" style={{ width: '100%', height: 56, borderRadius: 10, marginBottom: 10 }} />
        ))}
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
          <button style={tabStyle(tab === 'daily')} onClick={() => setTab('daily')}>Aujourd&apos;hui</button>
          <button style={tabStyle(tab === 'global')} onClick={() => setTab('global')}>Global</button>
          <button style={tabStyle(tab === 'season')} onClick={() => setTab('season')}>Saison</button>
        </div>

        {/* --- CONTENU DU CLASSEMENT --- */}
        <div>
          {tab === 'season' ? (
            /* ===== SEASON TAB ===== */
            <>
              {seasonInfo && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    {seasonInfo.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Du {new Date(seasonInfo.starts_at).toLocaleDateString('fr-FR')} au {new Date(seasonInfo.ends_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              )}

              {season.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>Aucun score saisonnier disponible.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* En-tete Desktop */}
                  {!isMobile && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '50px 1fr 90px 80px 90px',
                      padding: '0 12px 8px 12px',
                      borderBottom: '2px solid var(--border)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: 13
                    }}>
                      <span>#</span>
                      <span>Joueur</span>
                      <span style={{ textAlign: 'center' }}>Score</span>
                      <span style={{ textAlign: 'center' }}>Parties</span>
                      <span style={{ textAlign: 'center' }}>Rang</span>
                    </div>
                  )}

                  {season.map((entry, i) => {
                    const rankColor = RANK_COLORS[entry.rank] || 'var(--text)'
                    const rankName = RANK_NAMES[entry.rank] || entry.rank
                    const badgeIcons: Record<string, string> = {
                      first_win: '👣', word_master: '💬', bilingual: '🌐', explorer: '🔍',
                      scholar: '📚', challenger: '⚔️', streak_3: '🔥', sherlock: '🕵️',
                      streak_7: '🔥', veteran: '🎖️', speedrunner: '⚡', genius: '🧠',
                      streak_30: '🌋', legend: '👑', founder: '🏛️',
                      season_bronze: '🟤', season_silver: '⚪', season_gold: '🟡',
                      season_platinum: '💎', season_diamond: '💠',
                    }
                    return (
                      <div key={i} style={{
                        display: isMobile ? 'flex' : 'grid',
                        gridTemplateColumns: '50px 1fr 90px 80px 90px',
                        flexDirection: 'column',
                        padding: '12px',
                        backgroundColor: 'var(--surface)',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        position: 'relative'
                      }}>
                        {/* Position */}
                        <div style={{
                          fontWeight: 'bold',
                          fontSize: isMobile ? 18 : 16,
                          marginBottom: isMobile ? 8 : 0,
                          color: i < 3 ? 'var(--accent)' : 'var(--text)'
                        }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${entry.position}`}
                        </div>

                        {/* Username colored by rank + favorite badge */}
                        <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <a
                            href={`/player/${encodeURIComponent(entry.username)}`}
                            style={{
                              color: rankColor,
                              textDecoration: 'none',
                              transition: 'opacity 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                          >
                            {entry.username}
                          </a>
                          {entry.favorite_badge && (
                            <span title={entry.favorite_badge} style={{ fontSize: 16 }}>
                              {badgeIcons[entry.favorite_badge] || ''}
                            </span>
                          )}
                        </div>

                        {isMobile ? (
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
                            <div><strong>Score:</strong> {entry.total_score.toLocaleString()}</div>
                            <div><strong>Parties:</strong> {entry.games_played}</div>
                            <div style={{ color: rankColor, fontWeight: 600 }}>{rankName}</div>
                          </div>
                        ) : (
                          <>
                            <div style={{ textAlign: 'center', color: 'var(--text)', fontWeight: 600 }}>
                              {entry.total_score.toLocaleString()}
                            </div>
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              {entry.games_played}
                            </div>
                            <div style={{
                              textAlign: 'center',
                              color: rankColor,
                              fontWeight: 600,
                              fontSize: 13,
                            }}>
                              {rankName}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            /* ===== DAILY / GLOBAL TABS ===== */
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                {tab === 'daily' ? `Meilleurs scores du ${today}` : "Top joueurs (min. 5 parties)"}
              </div>

              {(tab === 'daily' ? daily : global).length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>Aucun score disponible.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* En-tete (Uniquement sur Desktop) */}
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
                      <span style={{ textAlign: 'center' }}>{tab === 'daily' ? 'Langue' : 'Min ess.'}</span>
                    </div>
                  )}

                  {/* Lignes de donnees */}
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
                      <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <a
                          href={`/player/${encodeURIComponent(entry.username)}`}
                          style={{
                            color: 'var(--text)',
                            textDecoration: 'none',
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
                        >
                          {entry.username}
                        </a>
                        {entry.favorite_badge && (() => {
                          const badgeIcons: Record<string, string> = {
                            first_win: '👣', word_master: '💬', bilingual: '🌐', explorer: '🔍',
                            scholar: '📚', challenger: '⚔️', streak_3: '🔥', sherlock: '🕵️',
                            streak_7: '🔥', veteran: '🎖️', speedrunner: '⚡', genius: '🧠',
                            streak_30: '🌋', legend: '👑',
                          }
                          return <span title={entry.favorite_badge} style={{ fontSize: 16 }}>{badgeIcons[entry.favorite_badge] || ''}</span>
                        })()}
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
                            <div><strong>Min ess.:</strong> {entry.best_guesses ?? entry.best_score}</div>
                          )}
                        </div>
                      ) : (
                        // Layout Desktop : Colonnes alignees
                        <>
                          <div style={{ textAlign: 'center', color: 'var(--text)' }}>
                            {tab === 'daily' ? entry.guess_count : entry.total_games}
                          </div>
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {tab === 'daily' ? (entry.duration_seconds ? `${Math.floor(entry.duration_seconds / 60)}m${entry.duration_seconds % 60}s` : '-') : entry.avg_guesses}
                          </div>
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {tab === 'daily' ? entry.lang.toUpperCase() : (entry.best_guesses ?? entry.best_score)}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}