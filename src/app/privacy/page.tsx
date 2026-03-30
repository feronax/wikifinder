import Header from '@/components/Header'
import CookieTable from './cookie-table'
import CookieSettingsButton from './cookie-settings-button'

export const metadata = {
  title: 'Politique de confidentialité — Wikifinder',
}

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' as const }}>
      <Header />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px', flex: 1 }}>

        <h1 style={{ fontSize: 28, color: 'var(--text)', marginBottom: 28 }}>Politique de confidentialité</h1>

        <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.8 }}>

          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            Dernière mise à jour : mars 2026
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>1. Responsable du traitement</h2>
          <p>
            Le site <strong>Wikifinder</strong> (wikifinder.vercel.app) est un projet personnel.
            Pour toute question relative à vos données, vous pouvez nous contacter via le formulaire de feedback intégré à l&apos;application.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>2. Données collectées</h2>

          <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Compte utilisateur (optionnel)</h3>
          <p>
            Si vous créez un compte, nous collectons votre adresse email et votre pseudo.
            Ces données sont stockées de manière sécurisée via <strong>Supabase</strong> (hébergé en Europe).
          </p>

          <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Données de jeu</h3>
          <p>
            Vos tentatives, scores et historique de parties sont enregistrés pour permettre le fonctionnement du jeu,
            le calcul des streaks et l&apos;affichage du classement.
          </p>

          <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Notifications push (optionnel)</h3>
          <p>
            Si vous activez les notifications, un identifiant technique de souscription est stocké.
            Il ne contient aucune donnée personnelle. Vous pouvez les désactiver à tout moment depuis votre profil.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>3. Cookies et traceurs</h2>
          <p>
            Wikifinder utilise <strong>Google Analytics 4</strong> (via Google Tag Manager) pour mesurer l&apos;audience du site.
            Le consentement est géré par <strong>Axeptio</strong>, qui vous permet d&apos;accepter ou de refuser les cookies de mesure d&apos;audience.
          </p>
          <p>
            Les cookies strictement nécessaires au fonctionnement du site (authentification, préférences de thème) ne requièrent pas de consentement.
          </p>

          <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>Liste des cookies et traceurs</h3>

          <CookieTable />

          <CookieSettingsButton />

          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>4. Finalités du traitement</h2>
          <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
            <li>Permettre le fonctionnement du jeu et la sauvegarde de la progression</li>
            <li>Afficher les classements et statistiques</li>
            <li>Envoyer des notifications push (si activées)</li>
            <li>Mesurer l&apos;audience du site (Google Analytics, avec consentement)</li>
          </ul>

          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>5. Partage des données</h2>
          <p>
            Vos données ne sont pas vendues ni partagées à des tiers, à l&apos;exception des prestataires techniques nécessaires au fonctionnement du service :
          </p>
          <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
            <li><strong>Supabase</strong> — base de données et authentification</li>
            <li><strong>Vercel</strong> — hébergement</li>
            <li><strong>Google Analytics</strong> — mesure d&apos;audience (avec consentement)</li>
            <li><strong>Axeptio</strong> — gestion du consentement cookies</li>
          </ul>

          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>6. Durée de conservation</h2>
          <p>
            Les données de compte et de jeu sont conservées tant que votre compte est actif.
            Les données d&apos;audience (Google Analytics) sont conservées selon les paramètres par défaut de Google (14 mois).
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>7. Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, de suppression et de portabilité de vos données.
            Vous pouvez exercer ces droits en nous contactant via le formulaire de feedback.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>8. Publicité</h2>
          <p>
            Wikifinder peut afficher des publicités non intrusives pour financer le service.
            Ces publicités ne sont pas ciblées sur la base de vos données personnelles sans votre consentement préalable.
          </p>

        </div>
      </div>
    </div>
  )
}
