export default function AuthErrorPage() {
  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 32, fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h2>Erreur de connexion</h2>
      <p style={{ color: '#666' }}>Une erreur est survenue lors de la connexion.</p>
      <a href="/auth/login" style={{ color: '#1a1a1a', fontWeight: 'bold' }}>Réessayer</a>
    </div>
  )
}