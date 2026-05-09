'use client'

import React, { useRef, useState, useMemo } from 'react'
import { ArrowUp } from 'lucide-react'
import { normalize } from '@/lib/matching'
import { isWordInArticle } from '@/lib/client-hash'
import { useSafeTimeout } from '@/lib/use-safe-timeout'

interface GuessInputProps {
  input: string
  setInput: (v: string) => void
  foundWordsByRecency: string[]
  // ALL guessed words (found + missed), most-recent-first.
  // Drives ArrowUp/Down history navigation. Optional for back-compat with
  // the unit test harness; treat absent as empty.
  triedWordsByRecency?: string[]
  triedSet: Set<string>
  onReveal: (normalizedWord: string, rawWord: string) => void
  onMiss: (word: string) => void
  gameId: string | null
  lang: 'fr' | 'en'
  disabled?: boolean
  // Mobile-tuned compact pill layout (iOS-style): drops the "ENTER A WORD"
  // label, inlines the submit as a circular accent button, and hides the
  // autocomplete suggestion chips when the input is empty (the chip strip
  // above the article already surfaces found words). Desktop keeps the
  // full label + stacked submit + always-on suggestion chips.
  compact?: boolean
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
  triedWordsByRecency,
  triedSet,
  onReveal,
  onMiss,
  gameId,
  lang,
  disabled,
  compact = false,
}: GuessInputProps) {
  const [activeIndex, setActiveIndex] = useState(-1)
  const [shake, setShake] = useState(false)
  // Shell-style history cursor for ArrowUp/Down navigation through
  // triedWordsByRecency. -1 means "off the list" (current input is the
  // user's own typing). Resets to -1 whenever the user types a character
  // or successfully submits a guess.
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const safeSetTimeout = useSafeTimeout()
  const history = triedWordsByRecency ?? []

  const suggestions = useMemo(() => {
    const norm = normalize(input)
    // Empty input → no suggestions. Without this guard every found word
    // matches the empty-prefix and clutters the input footer with stale
    // chips even before the user starts typing (the chip strip above the
    // article already surfaces found words).
    if (!norm) return []
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
    setHistoryIndex(-1)
    // Paired with enterKeyHint="send" — keeps the mobile soft keyboard open between guesses.
    inputRef.current?.focus()

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
    // Shell-style history nav: ArrowUp = previous (older) tried word,
    // ArrowDown = next (newer) toward empty input. Replaces the prior
    // autocomplete-chip arrow nav per user request — chips remain
    // clickable but no longer arrow-selectable.
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const next = historyIndex === -1 ? 0 : Math.min(historyIndex + 1, history.length - 1)
      setHistoryIndex(next)
      setInput(history[next])
      setActiveIndex(-1)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex <= 0) {
        setHistoryIndex(-1)
        setInput('')
        setActiveIndex(-1)
        return
      }
      const next = historyIndex - 1
      setHistoryIndex(next)
      setInput(history[next])
      setActiveIndex(-1)
      return
    }
    if (e.key === 'Escape') {
      setActiveIndex(-1)
      setHistoryIndex(-1)
    }
    // Enter falls through to form's onSubmit
  }

  const copy = COPY[lang]
  const isDisabled = disabled === true

  return (
    <div
      style={{
        background: compact ? 'transparent' : 'var(--wf-surface)',
        border: compact ? 'none' : '1px solid var(--wf-border)',
        borderRadius: compact ? 0 : 'var(--wf-radius-card)',
        padding: compact ? 0 : 16,
        fontFamily: 'var(--wf-font-ui)',
      }}
    >
      {!compact && (
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
      )}

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
        {compact ? (
          // iOS-style pill: input flexes left, circular submit on the right.
          // Single rounded container with embedded submit; no stacked button.
          <div
            className={shake ? 'wf-shake' : ''}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 4,
              paddingLeft: 14,
              background: 'var(--wf-bg2)',
              border:
                '1.5px solid ' +
                (shake ? '#f87171' : 'var(--wf-border)'),
              borderRadius: 999,
              transition: 'border-color 140ms, box-shadow 140ms',
            }}
            onFocus={(e) => {
              if (!shake) {
                e.currentTarget.style.borderColor = 'var(--wf-accent)'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.2)'
              }
            }}
            onBlur={(e) => {
              if (!shake) {
                e.currentTarget.style.borderColor = 'var(--wf-border)'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setActiveIndex(-1)
                setHistoryIndex(-1)
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
              enterKeyHint="send"
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                color: 'var(--wf-ink)',
                fontFamily: 'var(--wf-font-ui)',
                fontSize: 16,
                outline: 'none',
                padding: '8px 0',
              }}
            />
            <button
              type="submit"
              aria-label={copy.validate}
              disabled={isDisabled || !input.trim()}
              style={{
                flex: '0 0 auto',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--wf-accent)',
                color: 'var(--wf-accent-ink)',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor:
                  isDisabled || !input.trim() ? 'default' : 'pointer',
                opacity: isDisabled || !input.trim() ? 0.5 : 1,
                transition: 'opacity 140ms',
              }}
            >
              <ArrowUp size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setActiveIndex(-1)
                // User typed — drop out of history navigation so further
                // ArrowUp presses start fresh from index 0.
                setHistoryIndex(-1)
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
              enterKeyHint="send"
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
          </>
        )}
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
                onClick={() => {
                  // Auto-fill the input instead of re-submitting (the word
                  // is already in triedSet, so submit() would short-circuit
                  // into a shake animation — confusing UX).
                  setInput(s)
                  setActiveIndex(-1)
                  setHistoryIndex(-1)
                  inputRef.current?.focus()
                }}
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
