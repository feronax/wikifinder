'use client'
import { useEffect, useState } from 'react'

const LAST_SHOWN = 'wf_push_prompt_lastshown'
const STATE_KEY = 'wf_push_prompt_state' // 'never' | 'asked' | 'enabled' | 'denied'

type Mode = 'hidden' | 'sheet' | 'ios-fallback'
type Props = { lang?: 'fr' | 'en'; authed: boolean; completedTodayCount: number }

const COPY = {
  fr: {
    heading: 'Reçois un rappel quotidien',
    body: "Ne rate pas l'article du jour — on te rappelle une fois par jour, à 19h.",
    accept: 'Activer les rappels',
    later: 'Plus tard',
    iosHeading: 'Notifications non disponibles sur iOS Safari',
    iosBody: "Ajoute Wikifinder à ton écran d'accueil pour un rappel via l'icône.",
    iosClose: 'OK',
  },
  en: {
    heading: 'Get a daily reminder',
    body: "Don't miss today's article — we'll remind you once a day, at 7pm.",
    accept: 'Enable reminders',
    later: 'Maybe later',
    iosHeading: "Notifications aren't available on iOS Safari yet",
    iosBody: 'Add Wikifinder to your Home Screen for a daily reminder app icon.',
    iosClose: 'OK',
  },
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}

export default function PushOptInSheet({ lang = 'fr', authed, completedTodayCount }: Props) {
  const [mode, setMode] = useState<Mode>('hidden')

  useEffect(() => {
    if (!authed) return // D-30
    if (completedTodayCount < 1) return // D-27 first clause
    if (typeof window === 'undefined') return

    // Sticky permission states never re-prompt
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        try { localStorage.setItem(STATE_KEY, 'enabled') } catch {}
        return
      }
      if (Notification.permission === 'denied') {
        try { localStorage.setItem(STATE_KEY, 'denied') } catch {}
        return
      }
    }

    // 7-day suppression
    try {
      const last = localStorage.getItem(LAST_SHOWN)
      if (last) {
        const ageDays = (Date.now() - new Date(last).getTime()) / 86400000
        if (ageDays < 7) return
      }
    } catch { return }

    // Feature-detect for iOS fallback (D-28)
    const supported =
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    const nextMode: Mode = supported ? 'sheet' : 'ios-fallback'
    // Defer setState out of the effect body to avoid cascading-render lint rule
    const handle = queueMicrotask(() => {
      setMode(nextMode)
      try {
        localStorage.setItem(LAST_SHOWN, new Date().toISOString())
        localStorage.setItem(STATE_KEY, 'asked')
      } catch {}
    })
    return () => { void handle }
  }, [authed, completedTodayCount])

  async function accept() {
    // Pitfall 4 — fires ONLY here, inside a user click handler
    if (typeof Notification === 'undefined') { setMode('hidden'); return }
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        try { localStorage.setItem(STATE_KEY, 'denied') } catch {}
        setMode('hidden')
        return
      }
      try { localStorage.setItem(STATE_KEY, 'enabled') } catch {}

      // Reuse existing VAPID + service worker (already registered by Phase 1)
      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { setMode('hidden'); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      }).catch((err) => {
        console.error('[push] subscribe POST failed', err)
      })
    } catch (err) {
      console.error('[push] opt-in failed', err)
      try { localStorage.setItem(STATE_KEY, 'denied') } catch {}
    }
    setMode('hidden')
  }

  function dismiss() { setMode('hidden') }

  if (mode === 'hidden') return null

  const c = COPY[lang]
  const isIos = mode === 'ios-fallback'

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={isIos ? c.iosHeading : c.heading}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 900,
        background: 'var(--surface)',
        color: 'var(--text)',
        borderTop: '1px solid var(--border)',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2, margin: 0, color: 'var(--text)' }}>
        {isIos ? c.iosHeading : c.heading}
      </h2>
      <p style={{ fontSize: 16, lineHeight: 1.5, margin: 0, color: 'var(--text)' }}>
        {isIos ? c.iosBody : c.body}
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {!isIos && (
          <button
            type="button"
            onClick={dismiss}
            style={{
              minHeight: 44,
              padding: '0 16px',
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {c.later}
          </button>
        )}
        <button
          type="button"
          onClick={isIos ? dismiss : accept}
          style={{
            minHeight: 44,
            padding: '0 24px',
            borderRadius: 8,
            background: 'var(--accent)',
            color: 'var(--surface)',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {isIos ? c.iosClose : c.accept}
        </button>
      </div>
    </div>
  )
}
