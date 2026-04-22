'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRevealAnimation } from '@/hooks/useRevealAnimation'
import { useOccurrenceCycle } from '@/hooks/useOccurrenceCycle'
import LeftStatsColumn from '@/components/game/new/LeftStatsColumn'
import CenterArticle from '@/components/game/new/CenterArticle'
import RightTriedColumn from '@/components/game/new/RightTriedColumn'
import { normalize } from '@/lib/matching'
import type { GameState } from '@/app/game/types'
import type { FoundWordEntry } from '@/components/game/new/TriedWordRow'
import type { MissedWordEntry } from '@/components/game/new/RightTriedColumn'

export interface NewGameScreenProps {
  gameState: GameState
  input: string
  setInput: (v: string) => void
  elapsed: number
  lang: 'fr' | 'en'
  onMiss: (rawWord: string) => void
  onRevealHandled?: (normalizedWord: string, rawWord: string) => void
  // Phase 10.3 P3 — desktop ActionRow props (threaded from page.tsx new-design branch).
  // Mobile viewport continues to render NewGameScreenMobile which does not yet
  // surface these actions (P5 ships the mobile BurgerDrawer Actions section).
  won: boolean
  gameId: string | null
  pageId: string
  hintsUsed?: number
  onHintClick: () => void
  onGiveUpConfirmed: (revealData: unknown) => void
  onDuelCreate: () => Promise<void>
}

// Inline match-media hook — mirrors DOM media-query state for responsive grid.
function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mm = window.matchMedia(query)
    setMatches(mm.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mm.addEventListener('change', handler)
    return () => mm.removeEventListener('change', handler)
  }, [query])
  return matches
}

export default function NewGameScreen({
  gameState,
  input,
  setInput,
  elapsed,
  lang,
  onMiss,
  onRevealHandled,
  won,
  gameId,
  pageId: actionPageId,
  hintsUsed = 0,
  onHintClick,
  onGiveUpConfirmed,
  onDuelCreate,
}: NewGameScreenProps) {
  const reveal = useRevealAnimation()
  const cycle = useOccurrenceCycle()

  const isTablet = useMatchMedia('(max-width: 1199px)')

  // pageId for deterministic mask-width seeding (D-04). Prefer a stable string.
  const pageId: string = useMemo(() => {
    const pd = gameState.pageData
    return String(pd?.id ?? pd?.date ?? gameState.gameId ?? 'default')
  }, [gameState.pageData, gameState.gameId])

  // foundSet: normalized values of all found guesses
  const foundSet = useMemo(() => {
    const s = new Set<string>()
    for (const g of gameState.guesses) {
      if (g.found) s.add(normalize(g.word))
    }
    return s
  }, [gameState.guesses])

  // foundWordsByRecency: found guesses raw .word, most-recent-first
  const foundWordsByRecency = useMemo(() => {
    return gameState.guesses
      .filter((g) => g.found)
      .map((g) => g.word)
      .reverse()
  }, [gameState.guesses])

  // triedSet: normalized values for ALL guesses (found + missed) — duplicate guard
  const triedSet = useMemo(() => {
    const s = new Set<string>()
    for (const g of gameState.guesses) s.add(normalize(g.word))
    return s
  }, [gameState.guesses])

  // missed entries (most recent first)
  const missed = useMemo<MissedWordEntry[]>(() => {
    return gameState.guesses
      .filter((g) => !g.found)
      .map((g) => ({ display: g.word, normalized: normalize(g.word) }))
      .reverse()
  }, [gameState.guesses])

  // foundEntries — include occurrences count per word from article tokens.
  // Exclude stopwords: they share normalized forms with guessable words after
  // accent stripping (e.g. stopword "ne" collides with guess "né"), which
  // would inflate the chip count with tokens that aren't the user's match.
  const foundEntries = useMemo<FoundWordEntry[]>(() => {
    const occCount = new Map<string, number>()
    for (const t of gameState.tokens) {
      if (t.type === 'word' && !t.isStopword) {
        const n = normalize(t.value)
        occCount.set(n, (occCount.get(n) ?? 0) + 1)
      }
    }
    return foundWordsByRecency.map((w) => {
      const n = normalize(w)
      return { display: w, normalized: n, occurrences: occCount.get(n) ?? 0 }
    })
  }, [foundWordsByRecency, gameState.tokens])

  const totalRevealableTokens = useMemo(() => {
    return gameState.tokens.filter((t) => t.type === 'word' && !t.isStopword).length
  }, [gameState.tokens])

  // Orchestrator — animation trigger + parent-facing state commit callback.
  const handleReveal = useCallback(
    (normalizedWord: string, rawWord: string) => {
      reveal.trigger(normalizedWord)
      onRevealHandled?.(normalizedWord, rawWord)
    },
    [reveal, onRevealHandled],
  )

  // Different-word click cycle per D-15 §4 — reset other cursors first.
  const handleCycle = useCallback(
    (w: string) => {
      cycle.resetOthers(w)
      cycle.cycle(w)
    },
    [cycle],
  )

  const gridTemplateColumns = isTablet ? '1fr 280px' : '260px 1fr 280px'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: 24,
        maxWidth: 1200,
        margin: '0 auto',
        padding: '24px 32px 80px',
        fontFamily: 'var(--wf-font-ui)',
        color: 'var(--wf-ink)',
        background: 'var(--wf-bg)',
        minHeight: 'calc(100vh - 80px)',
      }}
    >
      {isTablet ? (
        // Tablet 2-col: Left stack spans full width above article, tried stays right.
        <>
          <div style={{ gridColumn: '1 / -1' }}>
            <LeftStatsColumn
              guessInputProps={{
                input,
                setInput,
                foundWordsByRecency,
                triedSet,
                onReveal: handleReveal,
                onMiss,
                gameId: gameState.gameId,
                lang,
                disabled: gameState.won,
              }}
              statsProps={{
                elapsed,
                attemptsCount: gameState.guessCount,
                foundCount: foundEntries.length,
                totalRevealableTokens,
                lang,
              }}
              actionRowProps={{
                lang,
                won,
                gameId,
                pageId: actionPageId,
                hintsUsed,
                onHintClick,
                onGiveUpConfirmed,
                onDuelCreate,
              }}
            />
          </div>
          <CenterArticle
            tokens={gameState.tokens}
            titleWords={gameState.titleWords}
            pageId={pageId}
            foundSet={foundSet}
            justRevealedWord={reveal.justRevealed}
            highlightedWord={cycle.highlighted?.word ?? null}
            lang={lang}
            attemptsCount={gameState.guessCount}
          />
          <RightTriedColumn
            found={foundEntries}
            missed={missed}
            onCycle={handleCycle}
            lang={lang}
          />
        </>
      ) : (
        <>
          <LeftStatsColumn
            guessInputProps={{
              input,
              setInput,
              foundWordsByRecency,
              triedSet,
              onReveal: handleReveal,
              onMiss,
              gameId: gameState.gameId,
              lang,
              disabled: gameState.won,
            }}
            statsProps={{
              elapsed,
              attemptsCount: gameState.guessCount,
              foundCount: foundEntries.length,
              totalRevealableTokens,
              lang,
            }}
            actionRowProps={{
              lang,
              won,
              gameId,
              pageId: actionPageId,
              hintsUsed,
              onHintClick,
              onGiveUpConfirmed,
              onDuelCreate,
            }}
          />
          <CenterArticle
            tokens={gameState.tokens}
            titleWords={gameState.titleWords}
            pageId={pageId}
            foundSet={foundSet}
            justRevealedWord={reveal.justRevealed}
            highlightedWord={cycle.highlighted?.word ?? null}
            lang={lang}
            attemptsCount={gameState.guessCount}
          />
          <RightTriedColumn
            found={foundEntries}
            missed={missed}
            onCycle={handleCycle}
            lang={lang}
          />
        </>
      )}
    </div>
  )
}
