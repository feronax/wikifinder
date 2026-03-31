import Header from '@/components/Header'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '70vh',
        padding: '0 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 80, marginBottom: 16, lineHeight: 1 }}>🔍</div>
        <h1 style={{ fontSize: 72, fontWeight: 700, color: 'var(--accent)', margin: '0 0 8px', lineHeight: 1 }}>
          404
        </h1>
        <p style={{ fontSize: 20, color: 'var(--text)', fontWeight: 600, marginBottom: 8 }}>
          Page introuvable
        </p>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 32, maxWidth: 400 }}>
          Cette page n&apos;existe pas. Peut-être qu&apos;elle a été déplacée, ou alors tu as tapé le mauvais mot...
        </p>
        <a href="/game" style={{
          display: 'inline-block',
          padding: '14px 32px',
          borderRadius: 10,
          backgroundColor: 'var(--accent)',
          color: 'white',
          fontSize: 16,
          fontWeight: 600,
          textDecoration: 'none',
          fontFamily: 'var(--font-sans)',
        }}>
          Retour au jeu
        </a>
      </div>
    </div>
  )
}
