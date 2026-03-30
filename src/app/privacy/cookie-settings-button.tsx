'use client'

declare global {
  interface Window {
    openAxeptioCookies?: () => void
  }
}

export default function CookieSettingsButton() {
  return (
    <button
      onClick={() => {
        if (typeof window !== 'undefined' && window.openAxeptioCookies) {
          window.openAxeptioCookies()
        }
      }}
      style={{
        marginTop: 16,
        marginBottom: 8,
        padding: '10px 20px',
        borderRadius: 8,
        border: '1px solid var(--accent)',
        backgroundColor: 'transparent',
        color: 'var(--accent)',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
      }}
    >
      Modifier mes préférences cookies
    </button>
  )
}
