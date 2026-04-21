'use client'

import React, { useRef, useState, useMemo } from 'react'
import { normalize } from '@/lib/matching'
import { isWordInArticle } from '@/lib/client-hash'
import { useSafeTimeout } from '@/lib/use-safe-timeout'

interface GuessInputProps {
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

const COPY = {
  fr: {
    placeholder: 'Tapez un mot…',
    aria: 'Proposer un mot',
    validate: 'Valider',
    label: 'ENTRER UN MOT',
  },
  en: {
    placeholder: 'Type a word…',
    aria: 'Guess a word',
    validate: 'Submit',
    label: 'ENTER A WORD',
  },
} as const

export default function GuessInput({
  input,
  setInput,
  foundWordsByRecency,
  triedSet,
  onReveal,
  onMiss,
  gameId,
  lang,
  disabled,
}: GuessInputProps) {
  const [activeIndex, setActiveIndex] = useState(-1)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const safeSetTimeout = useSafeTimeout()

  const suggestions = useMemo(() => {
    const norm = normalize(input)
    return foundWordsByRecency
      .filter((w) => {
        const nw = normalize(w)
        return nw.startsWith(norm) && nw !== norm
      })
      .slice(0, 5)
  }, [input, foundWordsByRecency])

  const triggerShake = () => {
    setShake(true)
    safeSetTimeout(() => setShake(false), 400)
  }

  const submit = async (rawInput: string) => {
    const raw = rawInput.trim()
    if (!raw) return
    const n = normalize(raw)

    // Duplicate short-circuit per UI-SPEC §Submit flow #6
    if (triedSet.has(n)) {
      triggerShake()
      setInput('')
      setActiveIndex(-1)
      return
    }

    // ========== SACRED <50ms PATH ==========
    // isWordInArticle resolves in ~1ms microtask via pre-loaded hashSet
    const inArticle = await isWordInArticle(n)
    setInput('')
    setActiveIndex(-1)

    if (inArticle) {
      performance.mark('guess:enter')
      // SYNCHRONOUS state commit — no await before this call.
      // Server sync is owned by the parent (page.tsx handleNewReveal) so the
      // /api/game/guess response can apply revealedTokens back to gameState.
      onReveal(n, raw)
    } else {
      triggerShake()
      onMiss(raw)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const n = suggestions.length
    if (e.key === 'ArrowDown' && n > 0) {
      e.preventDefault()
      setActiveIndex(activeIndex < 0 ? 0 : (activeIndex + 1) % n)
    } else if (e.key === 'ArrowUp' && n > 0) {
      e.preventDefault()
      setActiveIndex(activeIndex < 0 ? n - 1 : (activeIndex - 1 + n) % n)
    } else if (e.key === 'Escape') {
      setActiveIndex(-1)
    } else if (e.key === 'Tab' && activeIndex >= 0) {
      setActiveIndex(-1)
    }
    // Enter falls through to form's onSubmit
  }

  const copy = COPY[lang]
  const isDisabled = disabled === true

  return (
    <div
      style={{
        background: 'var(--wf-surface)',
        border: '1px solid var(--wf-border)',
        borderRadius: 'var(--wf-radius-card)',
        padding: 16,
        fontFamily: 'var(--wf-font-ui)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: 'var(--wf-muted)',
          marginBottom: 10,
        }}
      >
        {copy.label}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const picked =
            activeIndex >= 0 && suggestions[activeIndex]
              ? suggestions[activeIndex]
              : input
          void submit(picked)
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setActiveIndex(-1)
          }}
          onKeyDown={handleKeyDown}
          aria-label={copy.aria}
          aria-autocomplete="list"
          aria-controls="wf-autocomplete"
          aria-activedescendant={
            activeIndex >= 0 ? 'wf-ac-opt-' + activeIndex : undefined
          }
          placeholder={copy.placeholder}
          disabled={isDisabled}
          className={shake ? 'wf-shake' : ''}
          style={{
            width: '100%',
            padding: '12px 14px',
            background: 'var(--wf-bg2)',
            border:
              '1.5px solid ' +
              (shake ? '#f87171' : 'var(--wf-border)'),
            borderRadius: 'var(--wf-radius)',
            color: 'var(--wf-ink)',
            fontFamily: 'var(--wf-font-ui)',
            fontSize: 16,
            outline: 'none',
            transition: 'border-color 140ms',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            if (!shake) {
              e.currentTarget.style.borderColor = 'var(--wf-accent)'
              // Proto focus ring: 3px accent glow at ~20% opacity (33 hex)
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.2)'
            }
          }}
          onBlur={(e) => {
            if (!shake) {
              e.currentTarget.style.borderColor = 'var(--wf-border)'
              e.currentTarget.style.boxShadow = 'none'
            }
          }}
        />
        <button
          type="submit"
          disabled={isDisabled || !input.trim()}
          style={{
            width: '100%',
            marginTop: 10,
            padding: '11px 14px',
            background: 'var(--wf-accent)',
            color: 'var(--wf-accent-ink)',
            border: 'none',
            borderRadius: 'var(--wf-radius)',
            fontFamily: 'var(--wf-font-ui)',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.2,
            cursor:
              isDisabled || !input.trim() ? 'default' : 'pointer',
            opacity: isDisabled || !input.trim() ? 0.6 : 1,
          }}
        >
          {copy.validate}
        </button>
        {/* Inline suggestion chips — proto game.jsx:357-371 pattern.
            Shows up to 5 already-found words matching current prefix. */}
        {suggestions.length > 0 && (
          <div
            id="wf-autocomplete"
            role="listbox"
            aria-label={lang === 'fr' ? 'Suggestions' : 'Suggestions'}
            style={{
              marginTop: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
            }}
          >
            {suggestions.map((s, i) => (
              <button
                key={s}
                id={'wf-ac-opt-' + i}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => void submit(s)}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(-1)}
                style={{
                  padding: '3px 8px',
                  fontSize: 12,
                  background:
                    i === activeIndex
                      ? 'var(--wf-bg2)'
                      : 'transparent',
                  border: '1px solid var(--wf-border)',
                  color:
                    i === activeIndex
                      ? 'var(--wf-ink)'
                      : 'var(--wf-muted)',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'var(--wf-font-ui)',
                  transition: 'background 120ms, color 120ms',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  )
}
