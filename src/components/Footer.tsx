'use client'

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      backgroundColor: 'var(--bg)',
      padding: '24px 20px',
      marginTop: 'auto',
    }}>
      <div style={{
        maxWidth: 700,
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        fontSize: 13,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)',
      }}>
        <div>
          Wikifinder
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="/faq" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>
            FAQ
          </a>
          <a href="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>
            Politique de confidentialité
          </a>
        </div>
      </div>
    </footer>
  )
}
