'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#1a1a2e',
        color: 'white',
        padding: 40,
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>Oups, quelque chose s&apos;est mal passé</h2>
        <p style={{ fontSize: 15, color: '#9CA3AF', marginBottom: 24 }}>
          Une erreur inattendue est survenue.
        </p>
        <button
          onClick={reset}
          style={{
            padding: '12px 28px',
            borderRadius: 8,
            backgroundColor: '#7C3AED',
            color: 'white',
            border: 'none',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Réessayer
        </button>
      </body>
    </html>
  )
}
