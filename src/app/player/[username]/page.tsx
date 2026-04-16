'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Loader from '@/components/Loader'

const RARITY_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
}

type ModeStats = {
  totalGames: number
  totalWins: number
  winRate: number
  avgGuesses: number
  bestScore: number
  avgScore: number
  distribution: Record<string, number>
}

type Stats = {
  daily: ModeStats & { streak: number; bestStreak: number }
  ranked: ModeStats
}

type PlayerProfile = {
  username: string
  favoriteBadge: string | null
  memberSince: string
}

export default function PlayerProfilePage() {
  const params = useParams()
  const usernameParam = params.username as string
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [badges, setBadges] = useState<any[]>([])
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPlayer() {
      setLoading(true)
      try {
        const statsRes = await fetch(`/api/stats?username=${encodeURIComponent(usernameParam)}`)
        if (!statsRes.ok) {
          setNotFound(true)
          setLoading(false)
          return
        }
        const statsData = await statsRes.json()
        if (statsData.error) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setStats(statsData)
        setProfile({
          username: statsData.username || usernameParam,
          favoriteBadge: statsData.favoriteBadge || null,
          memberSince: statsData.memberSince || '',
        })

        if (statsData.userId) {
          const badgesRes = await fetch(`/api/badges?userId=${statsData.userId}`)
          const badgesData = await badgesRes.json()
          setBadges(badgesData.badges || [])
        }
      } catch {
        setNotFound(true)
      }
      setLoading(false)
    }
    loadPlayer()
  }, [usernameParam])

  const cardStyle = {
    marginBottom: 20,
    padding: 24,
    border: '1px solid var(--border)',
    borderRadius: 10,
    backgroundColor: 'var(--surface)',
  }

  const statValueStyle = {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--accent)',
    lineHeight: 1,
  }

  const statLabelStyle = {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 6,
    fontWeight: 500,
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div className="skeleton" style={{ width: 60, height: 60, borderRadius: '50%' }} />
          <div>
            <div className="skeleton" style={{ width: 150, height: 22, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 100, height: 14 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />
          ))}
        </div>
        <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 10 }} />
      </div>
      <Footer />
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>404</div>
        <div style={{ fontSize: 18, color: 'var(--text-muted)' }}>Joueur introuvable</div>
        <a href="/leaderboard" style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
          Retour au classement
        </a>
      </div>
      <Footer />
    </div>
  )

  const favBadge = profile?.favoriteBadge
    ? badges.find((b: any) => b.key === profile.favoriteBadge && b.unlocked)
    : null

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 20px', flex: 1 }}>

        {/* Player header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            backgroundColor: 'var(--accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: 'white', fontWeight: 700,
          }}>
            {favBadge ? favBadge.icon : (profile?.username?.[0]?.toUpperCase() || '?')}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: 'var(--text)' }}>{profile?.username}</h1>
            {profile?.memberSince && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Membre depuis {new Date(profile.memberSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </div>
            )}
            {favBadge && (
              <div style={{ fontSize: 13, color: RARITY_COLORS[favBadge.rarity] || 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
                {favBadge.icon} {favBadge.name}
              </div>
            )}
          </div>
        </div>

        {/* Stats — séparées par mode (quotidien / classé) */}
        {stats?.daily && stats.daily.totalGames > 0 && (
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 17, color: 'var(--text)' }}>📅 Quotidien</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={statValueStyle}>{stats.daily.totalGames}</div>
                <div style={statLabelStyle}>Parties jouees</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={statValueStyle}>{stats.daily.winRate}%</div>
                <div style={statLabelStyle}>Taux de victoire</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={statValueStyle}>{stats.daily.avgGuesses}</div>
                <div style={statLabelStyle}>Moy. tentatives</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={statValueStyle}>{stats.daily.bestScore.toLocaleString()}</div>
                <div style={statLabelStyle}>Meilleur score</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={statValueStyle}>{stats.daily.streak}</div>
                <div style={statLabelStyle}>Streak actuel</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={statValueStyle}>{stats.daily.bestStreak}</div>
                <div style={statLabelStyle}>Meilleur streak</div>
              </div>
            </div>
          </div>
        )}

        {stats?.ranked && stats.ranked.totalGames > 0 && (
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 17, color: 'var(--text)' }}>🏆 Classé</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={statValueStyle}>{stats.ranked.totalGames}</div>
                <div style={statLabelStyle}>Parties jouees</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={statValueStyle}>{stats.ranked.winRate}%</div>
                <div style={statLabelStyle}>Taux de victoire</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={statValueStyle}>{stats.ranked.avgGuesses}</div>
                <div style={statLabelStyle}>Moy. tentatives</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={statValueStyle}>{stats.ranked.bestScore.toLocaleString()}</div>
                <div style={statLabelStyle}>Meilleur score</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={statValueStyle}>{stats.ranked.avgScore.toLocaleString()}</div>
                <div style={statLabelStyle}>Score moyen</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={statValueStyle}>{stats.ranked.totalWins}</div>
                <div style={statLabelStyle}>Victoires</div>
              </div>
            </div>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 17, color: 'var(--text)' }}>Badges</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
            }}>
              {badges.map((badge: any) => {
                const unlocked = badge.unlocked
                const borderColor = unlocked ? RARITY_COLORS[badge.rarity] || 'var(--border)' : 'var(--border)'
                return (
                  <div
                    key={badge.key}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: 12,
                      borderRadius: 10,
                      border: `2px solid ${borderColor}`,
                      backgroundColor: 'var(--bg)',
                      opacity: unlocked ? 1 : 0.3,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 28 }}>{unlocked ? badge.icon : '🔒'}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginTop: 6 }}>{badge.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3 }}>{badge.description}</div>
                    <div style={{ fontSize: 10, color: borderColor, fontWeight: 600, textTransform: 'uppercase', marginTop: 4 }}>{badge.rarity}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
