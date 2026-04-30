'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useIsMobile } from '@/lib/utils'
import Header from '@/components/Header'
import Loader from '@/components/Loader'

// W-2 LOCKED 2026-04-18: /api/leaderboard/ is the ONLY leaderboard route dir
// (verified via grep of wikifinder/src/app/api/leaderboard/). The "Ranked" tab
// historically queried ?type=global (leaderboard_global view). Phase 3 adds
// ?type=survival. Page-facing param is ?mode= per CONTEXT D-12; fetch translates.
type Tab = 'daily' | 'ranked' | 'survival'
const MODE_TO_TYPE: Record<Tab, 'daily' | 'global' | 'survival'> = {
  daily: 'daily',
  ranked: 'global',
  survival: 'survival',
}

type SurvivalEntry = {
  username: string
  score: number
  completed_at: string
  lang: string
  chain_length: number
  position: number
  favorite_badge?: string | null
}

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
  best_guesses: number // MIN(guess_count) — nom clarifié côté DB le 2026-04-16
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

const translations = {
  fr: {
    title: 'Classement',
    tabAujourdhui: 'Aujourd\u2019hui',
    tabClasse: 'Classé',
    tabSurvival: 'Survival',
    rank: 'Rang',
    player: 'Joueur',
    score: 'Score',
    chain: 'Chaîne',
    date: 'Date',
    attempts: 'Essais',
    time: 'Temps',
    language: 'Langue',
    games: 'Parties',
    avg: 'Moyenne',
    avgShort: 'Moy',
    minAttempts: 'Min ess.',
    top100Survival: 'Top 100 — Survival',
    noSurvivalScores: 'Pas encore de scores Survival. Sois le premier !',
    noScores: 'Aucun score disponible.',
    todayBest: (d: string) => `Meilleurs scores du ${d.split('-').reverse().join('-')}`,
    topPlayers: 'Top joueurs (min. 5 parties)',
  },
  en: {
    title: 'Leaderboard',
    tabAujourdhui: 'Today',
    tabClasse: 'Ranked',
    tabSurvival: 'Survival',
    rank: 'Rank',
    player: 'Player',
    score: 'Score',
    chain: 'Chain',
    date: 'Date',
    attempts: 'Attempts',
    time: 'Time',
    language: 'Lang',
    games: 'Games',
    avg: 'Average',
    avgShort: 'Avg',
    minAttempts: 'Best att.',
    top100Survival: 'Top 100 — Survival',
    noSurvivalScores: 'No Survival scores yet. Be the first!',
    noScores: 'No scores available.',
    todayBest: (d: string) => `Best scores — ${d}`,
    topPlayers: 'Top players (min. 5 games)',
  },
} as const

export default function LegacyLeaderboardScreen() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }} />}>
      <LeaderboardPageInner />
    </Suspense>
  )
}

function LeaderboardPageInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeTab: Tab = ((sp.get('mode') as Tab) ?? 'daily')
  const langParam = sp.get('lang') as 'fr' | 'en' | null
  const [lang, setLangState] = useState<'fr' | 'en'>(langParam === 'en' ? 'en' : 'fr')
  const t = translations[lang]
  const [daily, setDaily] = useState<DailyEntry[]>([])
  const [global, setGlobal] = useState<GlobalEntry[]>([])
  const [survival, setSurvival] = useState<SurvivalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()
  const today = new Date().toISOString().split('T')[0]

  function setLang(next: 'fr' | 'en') {
    setLangState(next)
    const params = new URLSearchParams(sp?.toString() ?? '')
    params.set('lang', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [dailyRes, globalRes, survivalRes] = await Promise.all([
      fetch(`/api/leaderboard?type=${MODE_TO_TYPE.daily}&date=${today}`),
      fetch(`/api/leaderboard?type=${MODE_TO_TYPE.ranked}`),
      fetch(`/api/leaderboard?type=${MODE_TO_TYPE.survival}`),
    ])
    const dailyData = await dailyRes.json()
    const globalData = await globalRes.json()
    const survivalData = survivalRes.ok ? await survivalRes.json() : { leaderboard: [] }
    setDaily(dailyData.leaderboard || [])
    setGlobal(globalData.leaderboard || [])
    setSurvival(survivalData.leaderboard || [])
    setLoading(false)
  }

  function selectTab(next: Tab) {
    const params = new URLSearchParams(sp?.toString() ?? '')
    params.set('mode', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const tabLabels: Record<Tab, { fr: string; en: string }> = {
    daily: { fr: 'Aujourd\u2019hui', en: 'Today' },
    ranked: { fr: 'Classé', en: 'Ranked' },
    survival: { fr: 'Survival', en: 'Survival' },
  }

  function handleTabKeydown(e: React.KeyboardEvent, current: Tab) {
    const order: Tab[] = ['daily', 'ranked', 'survival']
    const idx = order.indexOf(current)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      selectTab(order[(idx + 1) % order.length])
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      selectTab(order[(idx - 1 + order.length) % order.length])
    }
  }

  const tabStyle = (active: boolean) => ({
    padding: '8px 20px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    borderBottom: active ? '2px solid var(--accent)' : '1px solid var(--border)',
    cursor: 'pointer',
    fontWeight: active ? '600' : '400',
    backgroundColor: active ? 'var(--bg-secondary)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    fontSize: 14,
    transition: '0.2s',
    flex: isMobile ? 1 : 'none',
    minHeight: 44,
  } as React.CSSProperties)

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header lang={lang} onLangChange={setLang} />
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
      <Header lang={lang} onLangChange={setLang} />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '24px 16px' : '32px 20px' }}>

        <h1 style={{ margin: '0 0 24px 0', fontSize: 28, color: 'var(--text)' }}>{t.title}</h1>

        {/* Tabs — 3-tab shell with URL state per D-12 (W-2 mapping in MODE_TO_TYPE) */}
        <div role="tablist" aria-label="Leaderboard modes" style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['daily', 'ranked', 'survival'] as const).map(mode => (
            <button
              key={mode}
              role="tab"
              aria-selected={activeTab === mode}
              aria-controls={`leaderboard-panel-${mode}`}
              id={`leaderboard-tab-${mode}`}
              tabIndex={activeTab === mode ? 0 : -1}
              style={tabStyle(activeTab === mode)}
              onClick={() => selectTab(mode)}
              onKeyDown={(e) => handleTabKeydown(e, mode)}
            >
              {tabLabels[mode][lang]}
            </button>
          ))}
        </div>

        {/* --- CONTENU DU CLASSEMENT --- */}
        <div
          role="tabpanel"
          id={`leaderboard-panel-${activeTab}`}
          aria-labelledby={`leaderboard-tab-${activeTab}`}
          aria-live="polite"
        >
          {activeTab === 'survival' ? (
            /* ===== SURVIVAL TAB ===== */
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                {t.top100Survival}
              </div>
              {survival.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>{t.noSurvivalScores}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {!isMobile && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '50px 1fr 90px 70px 90px',
                      padding: '0 12px 8px 12px',
                      borderBottom: '2px solid var(--border)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: 13,
                    }}>
                      <span>{t.rank}</span>
                      <span>{t.player}</span>
                      <span style={{ textAlign: 'center' }}>{t.score}</span>
                      <span style={{ textAlign: 'center' }}>{t.chain}</span>
                      <span style={{ textAlign: 'center' }}>{t.date}</span>
                    </div>
                  )}
                  {survival.map((entry, i) => (
                    <div key={i} style={{
                      display: isMobile ? 'flex' : 'grid',
                      gridTemplateColumns: '50px 1fr 90px 70px 90px',
                      flexDirection: 'column',
                      padding: '12px',
                      backgroundColor: 'var(--surface)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      alignItems: isMobile ? 'flex-start' : 'center',
                    }}>
                      <div style={{
                        fontWeight: 'bold',
                        fontSize: isMobile ? 18 : 16,
                        marginBottom: isMobile ? 8 : 0,
                        color: i < 3 ? 'var(--accent)' : 'var(--text)',
                      }}>
                        {i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : i === 2 ? '\uD83E\uDD49' : `#${entry.position}`}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>
                        <a
                          href={`/player/${encodeURIComponent(entry.username)}`}
                          style={{ color: 'var(--text)', textDecoration: 'none' }}
                        >
                          {entry.username}
                        </a>
                      </div>
                      {isMobile ? (
                        <div style={{
                          display: 'flex',
                          gap: 15,
                          marginTop: 8,
                          fontSize: 13,
                          color: 'var(--text-muted)',
                          width: '100%',
                          borderTop: '1px solid var(--border)',
                          paddingTop: 8,
                        }}>
                          <div><strong>{t.score}:</strong> {entry.score?.toLocaleString() ?? '-'}</div>
                          <div><strong>{t.chain}:</strong> {entry.chain_length ?? '-'}</div>
                          <div><strong>{t.date}:</strong> {entry.completed_at ? new Date(entry.completed_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US') : '-'}</div>
                        </div>
                      ) : (
                        <>
                          <div style={{ textAlign: 'center', color: 'var(--text)', fontWeight: 600 }}>
                            {entry.score?.toLocaleString() ?? '-'}
                          </div>
                          <div style={{ textAlign: 'center', color: 'var(--text)' }}>
                            {entry.chain_length ?? '-'}
                          </div>
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            {entry.completed_at ? new Date(entry.completed_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US') : '-'}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : false ? (
            /* ===== SEASON TAB — removed in Plan 03-05 ===== */
            <>{(() => { void RANK_COLORS; void RANK_NAMES; return null })()}
              {false && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    stub
                  </div>
                </div>
              )}

              {([] as SeasonEntry[]).length === 0 ? (
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

                  {([] as SeasonEntry[]).map((entry, i) => {
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
                {activeTab === 'daily' ? t.todayBest(today) : t.topPlayers}
              </div>

              {(activeTab === 'daily' ? daily : global).length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>{t.noScores}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* En-tete (Uniquement sur Desktop) */}
                  {!isMobile && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: activeTab === 'daily' ? '50px 1fr 100px 100px 80px' : '50px 1fr 80px 80px 80px',
                      padding: '0 12px 8px 12px',
                      borderBottom: '2px solid var(--border)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: 13
                    }}>
                      <span>#</span>
                      <span>{t.player}</span>
                      <span style={{ textAlign: 'center' }}>{activeTab === 'daily' ? t.attempts : t.games}</span>
                      <span style={{ textAlign: 'center' }}>{activeTab === 'daily' ? t.time : t.avg}</span>
                      <span style={{ textAlign: 'center' }}>{activeTab === 'daily' ? t.language : t.minAttempts}</span>
                    </div>
                  )}

                  {/* Lignes de donnees */}
                  {(activeTab === 'daily' ? daily : global).map((entry: any, i) => (
                    <div key={i} style={{
                      display: isMobile ? 'flex' : 'grid',
                      gridTemplateColumns: activeTab === 'daily' ? '50px 1fr 100px 100px 80px' : '50px 1fr 80px 80px 80px',
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
                            <strong>{activeTab === 'daily' ? t.attempts : t.games}:</strong> {activeTab === 'daily' ? entry.guess_count : entry.total_games}
                          </div>
                          <div>
                            <strong>{activeTab === 'daily' ? t.time : t.avgShort}:</strong> {activeTab === 'daily' ? (entry.duration_seconds ? `${Math.floor(entry.duration_seconds / 60)}m` : '-') : entry.avg_guesses}
                          </div>
                          {activeTab === 'ranked' && (
                            <div><strong>{t.minAttempts}:</strong> {entry.best_guesses}</div>
                          )}
                        </div>
                      ) : (
                        // Layout Desktop : Colonnes alignees
                        <>
                          <div style={{ textAlign: 'center', color: 'var(--text)' }}>
                            {activeTab === 'daily' ? entry.guess_count : entry.total_games}
                          </div>
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {activeTab === 'daily' ? (entry.duration_seconds ? `${Math.floor(entry.duration_seconds / 60)}m${entry.duration_seconds % 60}s` : '-') : entry.avg_guesses}
                          </div>
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {activeTab === 'daily' ? (entry.lang?.toUpperCase() ?? '—') : entry.best_guesses}
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