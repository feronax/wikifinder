'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'

// Phase 8: English aria-labels only. Phase 11 TODO: migrate to the i18n
// layer (LangProvider hook) when lang-prop migration happens. Do NOT
// import the LangProvider hook here — keeps this component decoupled
// from LangProvider and preserves wave-3 parallelism between plans
// 08-03 and 08-04 (B3 option b).
const ARIA_TO_DARK = 'Enable dark mode'
const ARIA_TO_LIGHT = 'Enable light mode'

export default function ModeToggle({ size = 34 }: { size?: number } = {}) {
  const { mode, setMode } = useTheme()
  const isDark = mode === 'dark'
  const nextMode: 'light' | 'dark' = isDark ? 'light' : 'dark'
  const ariaLabel = isDark ? ARIA_TO_LIGHT : ARIA_TO_DARK

  return (
    <button
      type='button'
      onClick={() => setMode(nextMode)}
      aria-label={ariaLabel}
      data-testid='mode-toggle'
      style={{
        width: size,
        height: size,
        padding: 0,
        borderRadius: 'var(--wf-radius)',
        border: '1px solid var(--wf-border)',
        backgroundColor: 'transparent',
        color: 'var(--wf-ink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'color 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--wf-accent)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--wf-ink)'
      }}
    >
      {isDark ? <Sun size={16} aria-hidden='true' /> : <Moon size={16} aria-hidden='true' />}
    </button>
  )
}
