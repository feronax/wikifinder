'use client'

import React, { Suspense, useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import Header from '@/components/Header'
import DuelLobby from '@/components/duel/DuelLobby'
import DuelWaitingPanel from '@/components/duel/DuelWaitingPanel'
import DuelComparisonPanel from '@/components/duel/DuelComparisonPanel'
import DuelPrivatePanel from '@/components/duel/DuelPrivatePanel'
import DuelShareCard from '@/components/duel/DuelShareCard'
import DuelToast from '@/components/duel/DuelToast'

type ViewerHalf = {
  userId: string
  username: string
  won: boolean
  guessCount: number | null
  durationSec: number | null
  dnf: boolean
}
type Opponent = { username: string; state: 'playing' | 'finished' }

type DuelResponse =
  | { error: string }
  | {
      state: 'lobby' | 'waiting' | 'ready' | 'expired-one' | 'expired-none' | 'private'
      room: { id: string; lang: 'fr' | 'en'; articleTitle: string; expiresAt: string; creatorUsername: string }
      viewer: { role: 'creator' | 'joiner' | 'candidate' | 'third-party' } & Partial<ViewerHalf>
      opponent?: Opponent | null
      comparison?: {
        kind: 'winner' | 'tie' | 'unresolved'
        winner?: ViewerHalf
        loser?: ViewerHalf
        a?: ViewerHalf
        b?: ViewerHalf
      }
    }

export default function DuelIdPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
          <div className="skeleton" style={{ width: 220, height: 28, marginBottom: 16, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: '100%', height: 16, marginBottom: 8, borderRadius: 4 }} />
          <div className="skeleton" style={{ width: '80%', height: 16, marginBottom: 24, borderRadius: 4 }} />
          <div className="skeleton" style={{ width: '100%', height: 44, borderRadius: 8 }} />
        </div>
      </div>
    }>
      <DuelIdPageInner />
    </Suspense>
  )
}

function DuelIdPageInner() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const sp = useSearchParams()
  const id = params?.id ?? ''
  const langParam = sp.get('lang') as 'fr' | 'en' | null
  const [uiLang, setUiLang] = useState<'fr' | 'en'>(langParam === 'en' || langParam === 'fr' ? langParam : 'fr')
  const supabase = createSupabaseBrowserClient()
  const [data, setData] = useState<DuelResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [langMismatchSub, setLangMismatchSub] = useState(false)
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)

  // Keep Header language toggle in sync with page UI language.
  const onLangChange = useCallback((l: 'fr' | 'en') => setUiLang(l), [])
  const onLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/')
  }, [router, supabase])

  const loadDuel = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/duel/${id}`, { cache: 'no-store' })
      const body = await res.json()
      setData(body)
    } catch {
      setData({ error: 'Network error' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { if (id) loadDuel() }, [id, loadDuel])

  const handleJoinAndStart = useCallback(async (forceLang?: 'fr' | 'en') => {
    if (!data || 'error' in data) return
    const useLang = forceLang ?? data.room.lang
    try {
      const joinRes = await fetch('/api/duel/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId: id, expectedLang: useLang }),
      })
      if (joinRes.status === 409) {
        const err = await joinRes.json()
        if (err?.error === 'lang_mismatch') {
          setLangMismatchSub(true)
          return
        }
      }
      if (!joinRes.ok) {
        setToast({ variant: 'error', message: uiLang === 'fr' ? 'Impossible de rejoindre' : 'Could not join' })
        return
      }
      router.push(`/game?duel=${id}&lang=${useLang}`)
    } catch {
      setToast({ variant: 'error', message: uiLang === 'fr' ? 'Erreur réseau' : 'Network error' })
    }
  }, [data, id, router, uiLang])

  const handleShareLink = useCallback(async () => {
    const url = `${window.location.origin}/duel/${id}`
    const nav = navigator as Navigator & { share?: (d: { url?: string; text?: string }) => Promise<void> }
    try {
      if (typeof nav.share === 'function') await nav.share({ url })
      else if (navigator.clipboard) await navigator.clipboard.writeText(url)
      setToast({ variant: 'success', message: uiLang === 'fr' ? 'Lien copié' : 'Link copied' })
    } catch {
      setToast({ variant: 'error', message: uiLang === 'fr' ? 'Partage annulé' : 'Share cancelled' })
    }
  }, [id, uiLang])

  const shell = (inner: React.ReactNode) => (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <Header lang={uiLang} onLangChange={onLangChange} onLogout={onLogout} />
      <div style={{ padding: 24, flex: 1 }}>{inner}</div>
    </div>
  )

  if (loading || !data) {
    return shell(
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div className="skeleton" style={{ width: 220, height: 28, marginBottom: 16, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: '100%', height: 16, marginBottom: 8, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: '80%', height: 16, marginBottom: 24, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 160, height: 13, marginBottom: 24, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: '100%', height: 44, borderRadius: 8 }} />
      </div>,
    )
  }
  if ('error' in data) {
    return shell(<DuelPrivatePanel lang={uiLang} onPlayToday={() => router.push('/game')} />)
  }

  const { state, room, viewer, opponent, comparison } = data

  if (state === 'private') {
    return shell(<DuelPrivatePanel lang={uiLang} onPlayToday={() => router.push('/game')} />)
  }

  if (state === 'lobby') {
    const sub = viewer.role === 'candidate'
      ? 'anon' as const
      : viewer.role === 'creator'
        ? 'self-duel' as const
        : langMismatchSub
          ? 'lang-mismatch' as const
          : 'authed-match' as const
    return shell(
      <>
        <DuelLobby
          sub={sub}
          creatorUsername={room.creatorUsername}
          roomLang={room.lang}
          expiresAt={room.expiresAt}
          lang={uiLang}
          duelId={id}
          onStart={() => handleJoinAndStart()}
          onSwitchLang={() => handleJoinAndStart(room.lang)}
          onCancel={() => setLangMismatchSub(false)}
          onShareLink={handleShareLink}
          onSignIn={() => router.push(`/login?next=/duel/${id}`)}
        />
        {toast && <DuelToast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />}
      </>,
    )
  }

  if (state === 'waiting') {
    const opponentName = opponent?.username ?? ''
    return shell(
      <>
        <DuelWaitingPanel
          opponentUsername={opponentName}
          expiresAt={room.expiresAt}
          lang={uiLang}
          onRefresh={loadDuel}
          onShareLink={handleShareLink}
        />
        {toast && <DuelToast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />}
      </>,
    )
  }

  if (state === 'ready' || state === 'expired-one') {
    const isTie = comparison?.kind === 'tie'
    const unresolved = comparison?.kind === 'unresolved'
    const variant = unresolved ? 'unresolved' as const
      : isTie ? 'tie' as const
      : state === 'expired-one' ? 'ended' as const
      : 'result' as const
    const winner = comparison?.winner
    const loser = comparison?.loser
    const both = comparison?.a && comparison?.b
      ? [comparison.a, comparison.b] as [ViewerHalf, ViewerHalf]
      : undefined

    const shareLeft = winner ?? (both?.[0] ?? null)
    const shareRight = loser ?? (both?.[1] ?? null)

    const shareSlot = shareLeft && shareRight ? (
      <DuelShareCard
        variant={isTie ? 'tie' : variant === 'ended' ? 'ended' : 'winner'}
        left={{
          username: shareLeft.username, guessCount: shareLeft.guessCount,
          durationSec: shareLeft.durationSec, won: shareLeft.won, dnf: shareLeft.dnf,
        }}
        right={{
          username: shareRight.username, guessCount: shareRight.guessCount,
          durationSec: shareRight.durationSec, won: shareRight.won, dnf: shareRight.dnf,
        }}
        articleTitle={room.articleTitle}
        duelUrl={`/duel/${id}`}
        lang={uiLang}
        altText={uiLang === 'fr' ? 'Carte de duel Wikifinder' : 'Wikifinder duel card'}
        label={uiLang === 'fr' ? 'Partager le résultat' : 'Share result'}
      />
    ) : undefined

    return shell(
      <>
        <DuelComparisonPanel
          variant={variant}
          winner={winner}
          loser={loser}
          both={both}
          articleTitle={room.articleTitle}
          lang={uiLang}
          shareSlot={shareSlot}
          onHome={() => router.push('/')}
        />
        {toast && <DuelToast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />}
      </>,
    )
  }

  // expired-none
  return shell(
    <DuelComparisonPanel
      variant="unresolved"
      articleTitle={room.articleTitle}
      lang={uiLang}
      onHome={() => router.push('/')}
    />,
  )
}
