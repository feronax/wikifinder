'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in window.navigator && (window.navigator as any).standalone)
    setIsStandalone(standalone)

    // Check if dismissed before
    if (sessionStorage.getItem('install-banner-dismissed')) {
      setDismissed(true)
    }

    // iOS detection
    const ua = window.navigator.userAgent
    const isIosDevice = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
    setIsIos(isIosDevice)

    // Android/Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function handleDismiss() {
    setDismissed(true)
    sessionStorage.setItem('install-banner-dismissed', 'true')
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setDismissed(true)
    }
  }

  // Don't show if already installed, dismissed, or not on mobile
  if (isStandalone || dismissed) return null
  if (!deferredPrompt && !isIos) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      padding: '12px 16px',
      backgroundColor: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontFamily: 'var(--font-sans)',
    }}>
      <img src="/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          Installer Wikifinder
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {isIos ? 'Appuie sur Partager puis "Sur l\'écran d\'accueil"' : 'Ajoute le jeu à ton écran d\'accueil'}
        </div>
      </div>
      {!isIos && deferredPrompt && (
        <button onClick={handleInstall} style={{
          padding: '8px 16px', borderRadius: 8,
          backgroundColor: 'var(--accent)', color: 'white',
          border: 'none', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', flexShrink: 0,
        }}>
          Installer
        </button>
      )}
      <button onClick={handleDismiss} style={{
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontSize: 18, cursor: 'pointer', padding: '0 4px', flexShrink: 0,
      }}>
        ✕
      </button>
    </div>
  )
}
