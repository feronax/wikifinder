'use client'

import { useLang } from '@/components/LangProvider'
import ModeToggle from '@/components/design/ModeToggle'

// Phase 8 Plan 05 (TH-08, D-03): the ONLY language-change surface in the new UI.
// Consumes useLang() directly; ModeToggle composes useTheme() internally.
// Styled with legacy --surface/--border/--text tokens to stay consistent with
// surrounding profile/page.tsx cards (D-Discretion, PATTERNS convention #6).
export default function Preferences() {
  const { lang, setLang } = useLang()
  const heading = lang === 'fr' ? 'Préférences' : 'Preferences'
  const langLabel = lang === 'fr' ? 'Langue' : 'Language'
  const modeLabel = lang === 'fr' ? 'Apparence' : 'Appearance'

  return (
    <div
      data-testid='preferences-card'
      style={{
        marginBottom: 20,
        padding: 24,
        border: '1px solid var(--border)',
        borderRadius: 10,
        backgroundColor: 'var(--surface)',
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 17, color: 'var(--text)' }}>
        {heading}
      </h2>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{langLabel}</span>
        <div data-testid='lang-pill' style={{ display: 'flex', gap: 4 }}>
          {(['fr', 'en'] as const).map((l) => (
            <button
              key={l}
              type='button'
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              data-testid={l === 'fr' ? 'lang-fr' : 'lang-en'}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                backgroundColor: lang === l ? 'var(--accent)' : 'transparent',
                color: lang === l ? 'white' : 'var(--text-muted)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: '0.2s',
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{modeLabel}</span>
        <ModeToggle />
      </div>
    </div>
  )
}
