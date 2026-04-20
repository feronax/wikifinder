'use client'

import { useTheme } from '@/components/ThemeProvider'
import { tokens as tokensData } from '@/lib/design/tokens'
import { Flame, Mail, Search, X, Check, Moon, Sun } from 'lucide-react'

function toKebab(s: string) {
  return s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
}

export default function DesignSandboxClient() {
  const { mode, setMode } = useTheme()
  const set = tokensData[mode]
  const entries = Object.entries(set) as [keyof typeof set, string][]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--wf-font-head)',
            fontSize: 28,
            fontWeight: 600,
            margin: 0,
            color: 'var(--wf-ink)',
          }}
        >
          Design Sandbox
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setMode('dark')}
            disabled={mode === 'dark'}
            style={{ padding: '8px 14px', fontFamily: 'var(--wf-font-ui)' }}
            data-testid="sandbox-mode-dark"
          >
            Dark
          </button>
          <button
            onClick={() => setMode('light')}
            disabled={mode === 'light'}
            style={{ padding: '8px 14px', fontFamily: 'var(--wf-font-ui)' }}
            data-testid="sandbox-mode-light"
          >
            Light
          </button>
          <span
            style={{
              padding: '8px 14px',
              fontFamily: 'var(--wf-font-ui)',
              color: 'var(--wf-muted)',
            }}
            data-testid="sandbox-mode-current"
          >
            current: {mode}
          </span>
        </div>
      </header>

      <section data-testid="sandbox-swatches">
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 1.4,
            marginBottom: 12,
            color: 'var(--wf-muted)',
          }}
        >
          Tokens ({entries.length})
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {entries.map(([key, value]) => {
            const cssVar = '--wf-' + toKebab(String(key))
            const isColor = typeof value === 'string' && value.startsWith('#')
            return (
              <div
                key={String(key)}
                data-testid={`swatch-${String(key)}`}
                style={{
                  border: '1px solid var(--wf-border)',
                  borderRadius: 'var(--wf-radius-card)',
                  padding: 12,
                  background: 'var(--wf-surface)',
                  color: 'var(--wf-ink)',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: 40,
                    background: `var(${cssVar})`,
                    border: isColor ? '1px solid var(--wf-border-strong)' : 'none',
                    borderRadius: 'var(--wf-radius)',
                    marginBottom: 8,
                  }}
                />
                <div
                  style={{
                    fontSize: 13,
                    fontFamily: 'var(--wf-font-ui)',
                    fontWeight: 500,
                  }}
                >
                  {String(key)}
                </div>
                <code style={{ fontSize: 11, color: 'var(--wf-muted)' }}>{cssVar}</code>
                <div style={{ fontSize: 11, color: 'var(--wf-muted)' }}>{String(value)}</div>
              </div>
            )
          })}
        </div>
      </section>

      <section data-testid="sandbox-fonts">
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 1.4,
            marginBottom: 12,
            color: 'var(--wf-muted)',
          }}
        >
          Fonts
        </h2>
        <div
          style={{
            fontFamily: 'var(--wf-font-head)',
            fontSize: 32,
            color: 'var(--wf-ink)',
          }}
        >
          Geist — The quick brown fox jumps over the lazy dog
        </div>
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            fontFamily: 'var(--wf-font-head)',
            color: 'var(--wf-ink)',
            marginTop: 8,
          }}
        >
          <span style={{ fontWeight: 400 }}>Geist 400</span>
          <span style={{ fontWeight: 500 }}>Geist 500</span>
          <span style={{ fontWeight: 600 }}>Geist 600</span>
          <span style={{ fontWeight: 700 }}>Geist 700</span>
        </div>
        <div
          style={{
            fontFamily: 'var(--wf-font-article)',
            fontSize: 20,
            color: 'var(--wf-ink)',
            marginTop: 12,
          }}
        >
          Source Serif 4 — Le vif renard brun saute par-dessus le chien paresseux
        </div>
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            fontFamily: 'var(--wf-font-article)',
            color: 'var(--wf-ink)',
            marginTop: 8,
          }}
        >
          <span style={{ fontWeight: 400 }}>Serif 400</span>
          <span style={{ fontWeight: 500 }}>Serif 500</span>
          <span style={{ fontWeight: 600 }}>Serif 600</span>
          <span style={{ fontWeight: 700 }}>Serif 700</span>
        </div>
      </section>

      <section data-testid="sandbox-icons">
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 1.4,
            marginBottom: 12,
            color: 'var(--wf-muted)',
          }}
        >
          Lucide smoke
        </h2>
        <div style={{ display: 'flex', gap: 16, color: 'var(--wf-ink)' }}>
          <Flame aria-label="flame" />
          <Mail aria-label="mail" />
          <Search aria-label="search" />
          <X aria-label="close" />
          <Check aria-label="check" />
          <Moon aria-label="moon" />
          <Sun aria-label="sun" />
        </div>
      </section>
    </div>
  )
}
