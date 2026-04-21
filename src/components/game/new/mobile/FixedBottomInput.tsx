'use client'

import React from 'react'
import GuessInput from '@/components/game/new/GuessInput'

/**
 * FixedBottomInput — fixed-position keyboard-aware wrapper around Phase-9 GuessInput.
 *
 * CRITICAL: This component WRAPS GuessInput verbatim. The sacred <50ms submit path
 * lives inside GuessInput.tsx:77-106 and MUST NOT be modified. This wrapper only
 * positions the input and rotates the autocomplete dropdown direction via a
 * container CSS rule (see `.wf-fixed-bottom-input [role="listbox"]` in globals.css).
 *
 * Keyboard handling:
 *   - `bottom: var(--wf-kb-inset, 0px)` reads the CSS var written by useKeyboardInset
 *     (Plan 02). The hook is mounted once in NewGameScreenMobile (Plan 05);
 *     this component does NOT call the hook itself (per Pitfall 7).
 *   - `transition: bottom 160ms ease-out` smooths keyboard show/hide. If GS-09
 *     latency profiling later shows article reflow, switch to transform (Phase 13).
 *
 * z-index 95: above BottomTabBar (90), below drawer overlay (100).
 */

export interface FixedBottomInputProps {
  input: string
  setInput: (v: string) => void
  foundWordsByRecency: string[]
  triedSet: Set<string>
  onReveal: (normalizedWord: string, rawWord: string) => void
  onMiss: (word: string) => void
  gameId: string | null
  lang: 'fr' | 'en'
  disabled?: boolean
}

export default function FixedBottomInput(props: FixedBottomInputProps) {
  return (
    <div
      className="wf-fixed-bottom-input"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'var(--wf-kb-inset, 0px)',
        zIndex: 95,
        background: 'var(--wf-surface)',
        borderTop: '1px solid var(--wf-border-strong)',
        boxShadow: '0 -4px 20px rgb(0 0 0 / 0.3)',
        padding: '12px 16px',
        transition: 'bottom 160ms ease-out',
      }}
    >
      <GuessInput {...props} />
    </div>
  )
}
