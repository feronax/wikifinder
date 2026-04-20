export type FeedEntry = {
  userId: string
  username: string
  guessCount: number
  score: number | null
  completedAt: string | null
  won: boolean
}

function relativeTime(iso: string | null, lang: 'fr' | 'en'): string {
  if (!iso) return lang === 'fr' ? 'En cours' : 'Playing'
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return lang === 'fr' ? `il y a ${m} min` : `${m}m ago`
  const h = Math.floor(m / 60)
  return lang === 'fr' ? `il y a ${h} h` : `${h}h ago`
}

function initials(u: string): string {
  return u.slice(0, 2).toUpperCase()
}

export default function FeedRow({ entry, lang }: { entry: FeedEntry; lang: 'fr' | 'en' }) {
  const status = entry.won
    ? (lang === 'fr' ? 'Gagné' : 'Won')
    : entry.completedAt
      ? (lang === 'fr' ? 'Abandon' : 'DNF')
      : (lang === 'fr' ? 'En cours' : 'Playing')

  return (
    <a
      href={`/u/${entry.username}`}
      role="listitem"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        minHeight: 48,
        borderBottom: '1px solid var(--border)',
        textDecoration: 'none',
        color: 'var(--text)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          background: 'var(--accent)',
          color: 'var(--surface)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {initials(entry.username)}
      </span>
      <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entry.username}
      </span>
      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{status}</span>
      <span style={{ fontSize: 14 }}>{entry.guessCount}</span>
      {entry.score !== null && <span style={{ fontSize: 14 }}>{entry.score}</span>}
      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{relativeTime(entry.completedAt, lang)}</span>
    </a>
  )
}
