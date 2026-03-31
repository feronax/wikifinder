import Header from '@/components/Header'

const faqs = [
  { q: 'C\'est quoi Wikifinder ?', a: 'Wikifinder est un jeu quotidien gratuit où tu dois deviner un article Wikipedia mot par mot. Chaque jour, un nouvel article est sélectionné — les mots sont masqués et tu dois les révéler en proposant des mots.' },
  { q: 'Comment on joue ?', a: 'Tu tapes un mot dans le champ de saisie. Si ce mot apparaît dans l\'article, il se révèle partout dans le texte. Ton objectif est de trouver tous les mots du titre de l\'article en un minimum de tentatives.' },
  { q: 'Est-ce que je dois créer un compte ?', a: 'Non, tu peux jouer sans compte. Mais en créant un compte gratuit, tu peux sauvegarder ta progression, suivre tes streaks, apparaître dans le classement et accéder à tes statistiques.' },
  { q: 'À quelle heure le nouvel article est disponible ?', a: 'Un nouvel article est disponible chaque jour à minuit (heure de Paris). Tu reçois une notification si tu les as activées.' },
  { q: 'Le jeu est disponible en anglais ?', a: 'Oui ! Tu peux jouer en français ou en anglais. Chaque article existe dans les deux langues avec un contenu différent.' },
  { q: 'Comment le score est-il calculé ?', a: 'Le score dépend du nombre de tentatives. Moins tu fais de tentatives, plus ton score est élevé. Le score maximum est de 5 000 points.' },
]

export const metadata = {
  title: 'FAQ — Wikifinder',
  description: 'Questions fréquentes sur Wikifinder, le jeu quotidien Wikipedia.',
}

export default function FaqPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' as const }}>
      <Header />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px', flex: 1 }}>
        <h1 style={{ fontSize: 28, color: 'var(--text)', marginBottom: 24 }}>Questions fréquentes</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {faqs.map((faq, i) => (
            <details key={i} style={{
              padding: '16px 20px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              cursor: 'pointer',
            }}>
              <summary style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                {faq.q}
              </summary>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        {/* JSON-LD FAQ */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map(faq => ({
              '@type': 'Question',
              name: faq.q,
              acceptedAnswer: { '@type': 'Answer', text: faq.a },
            })),
          }) }}
        />
      </div>
    </div>
  )
}
