import Header from '@/components/Header'

export default function AuthErrorPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div style={{ maxWidth: 400, margin: '80px auto', padding: 32, textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text)', marginBottom: 12 }}>Erreur de connexion</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Une erreur est survenue lors de la connexion.</p>
        <a href="/auth/login" style={{
          color: 'var(--accent)',
          fontWeight: 600,
          textDecoration: 'none',
          padding: '8px 20px',
          borderRadius: 6,
          border: '1px solid var(--accent)',
        }}>
          Réessayer
        </a>
      </div>
    </div>
  )
}