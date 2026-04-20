'use client'

import { useEffect, useRef, useState } from 'react'
import FollowButton from './FollowButton'

type Result = { id: string; username: string }
type Props = { lang: 'fr' | 'en' }

export default function FollowSearchInput({ lang }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const labels = lang === 'fr'
    ? { placeholder: 'Chercher un joueur…', none: 'Aucun résultat' }
    : { placeholder: 'Search for a player…', none: 'No results' }

  // HARD-06: always clear debounce + in-flight fetch on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  function onChange(value: string) {
    setQ(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(value.trim())}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        })
        if (!res.ok) {
          setResults([])
          setOpen(true)
          return
        }
        const body = await res.json()
        setResults(Array.isArray(body.results) ? body.results : [])
        setOpen(true)
      } catch {
        // Aborted or network error — silent per HARD-04.
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        placeholder={labels.placeholder}
        aria-label={labels.placeholder}
        maxLength={32}
        style={{
          width: '100%',
          minHeight: 44,
          padding: '0 14px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 15,
          fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
        }}
      />
      {open && q.trim().length >= 2 && (
        <div
          role="listbox"
          style={{
            marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            maxHeight: 280,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {loading && results.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 14 }}>…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 14 }}>{labels.none}</div>
          ) : (
            results.map((r) => (
              <div
                key={r.id}
                role="option"
                aria-selected={false}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border)',
                  minHeight: 48,
                }}
              >
                <a
                  href={`/player/${encodeURIComponent(r.username)}`}
                  style={{
                    flex: 1,
                    color: 'var(--text)',
                    textDecoration: 'none',
                    fontWeight: 500,
                    fontSize: 15,
                  }}
                >
                  {r.username}
                </a>
                <FollowButton targetUserId={r.id} initialState="follow" lang={lang} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
