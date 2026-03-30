'use client'

import { useIsMobile } from '@/lib/utils'

const cookies = [
  { name: '_ga', provider: 'Google Analytics', type: 'Mesure d\'audience', duration: '2 ans', desc: 'Identifiant unique utilisé pour distinguer les utilisateurs et générer des statistiques d\'utilisation.' },
  { name: '_ga_*', provider: 'Google Analytics', type: 'Mesure d\'audience', duration: '2 ans', desc: 'Utilisé pour conserver l\'état de la session GA4.' },
  { name: '_pcid', provider: 'Axeptio', type: 'Consentement', duration: '13 mois', desc: 'Identifiant du navigateur pour la gestion du consentement.' },
  { name: '_pctx', provider: 'Axeptio', type: 'Consentement', duration: '13 mois', desc: 'Contexte technique pour le widget de consentement.' },
  { name: '_pprv', provider: 'Axeptio', type: 'Consentement', duration: '13 mois', desc: 'Sauvegarde des préférences précédentes de consentement.' },
  { name: 'axeptio_all_vendors', provider: 'Axeptio', type: 'Consentement', duration: '13 mois', desc: 'Liste de tous les fournisseurs proposés dans le bandeau de consentement.' },
  { name: 'axeptio_authorized_vendors', provider: 'Axeptio', type: 'Consentement', duration: '13 mois', desc: 'Liste des fournisseurs acceptés par l\'utilisateur.' },
  { name: 'axeptio_cookies', provider: 'Axeptio', type: 'Consentement', duration: '13 mois', desc: 'Préférences détaillées de consentement par catégorie de cookies.' },
  { name: 'sb-*-auth-token', provider: 'Supabase', type: 'Fonctionnel', duration: 'Session', desc: 'Jeton d\'authentification permettant de maintenir la session utilisateur.' },
  { name: 'sb-*-auth-token (refresh)', provider: 'Supabase', type: 'Fonctionnel', duration: 'Session', desc: 'Jeton de rafraîchissement pour renouveler la session expirée.' },
  { name: 'theme', provider: 'Wikifinder', type: 'Fonctionnel', duration: 'Permanent', desc: 'Préférence de thème (clair/sombre), stockée en localStorage.' },
]

export default function CookieTable() {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {cookies.map((cookie, i) => (
          <div key={i} style={{
            padding: 16,
            borderRadius: 10,
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            fontSize: 14,
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>
              {cookie.name}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: 'var(--bg)', fontSize: 12, color: 'var(--text-muted)' }}>
                {cookie.provider}
              </span>
              <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: 'var(--bg)', fontSize: 12, color: 'var(--text-muted)' }}>
                {cookie.type}
              </span>
              <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: 'var(--bg)', fontSize: 12, color: 'var(--text-muted)' }}>
                {cookie.duration}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
              {cookie.desc}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 16 }}>
      <thead>
        <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
          <th style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>Cookie</th>
          <th style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>Fournisseur</th>
          <th style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>Type</th>
          <th style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>Durée</th>
          <th style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>Description</th>
        </tr>
      </thead>
      <tbody>
        {cookies.map((cookie, i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{cookie.name}</td>
            <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{cookie.provider}</td>
            <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{cookie.type}</td>
            <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{cookie.duration}</td>
            <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{cookie.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
