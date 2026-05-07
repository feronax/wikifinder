'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRevealAnimation } from '@/hooks/useRevealAnimation'
import { useOccurrenceCycle } from '@/hooks/useOccurrenceCycle'
import LeftStatsColumn from '@/components/game/new/LeftStatsColumn'
import CenterArticle from '@/components/game/new/CenterArticle'
import RightTriedColumn from '@/components/game/new/RightTriedColumn'
import ResultModal from './ResultModal'
import { normalize, wordsMatch, splitOnApostrophe } from '@/lib/matching'
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
  // Phase 10.3-08 — desktop ActionRow reduced to single Défier button.
  // Indice + Abandonner removed per UAT scope change (Gaps B + C).
  onDuelCreate: () => Promise<void>
  // Phase 10.3 P4 — ResultModal plumbing. `streak` is prop-drilled from
  // page.tsx (the P1 win-trigger already populates page-level `streak`
  // state). Kept optional for backward-compat on non-authed paths.
  streak?: number | null
  // Phase 10.3-09 (Gap A) — pseudo + badge row in ResultModal.
  // `username` null when anonymous → pseudo row is hidden.
  // `favoriteBadge` null when user has no equipped badge → emoji is omitted.
  username?: string | null
  favoriteBadge?: string | null
  // Phase 12 / Plan 05 — burger entry callbacks for parity with mobile.
  // Desktop has no overflow menu yet (deferred surface per RESEARCH
  // "Component Responsibilities"); props plumbed for prop-shape parity
  // so page.tsx can pass them uniformly to both screens.
  onOpenOnboarding?: () => void
  onOpenFeedback?: () => void
  // Phase 12 / Plan 05 — defeat-state ResultModal trigger.
  revealAll?: boolean
  // Phase 13 / Plan 04 (D-12, MOD-03) — defeat "Voir la solution" CTA.
  // Forwarded to ActionRow via LeftStatsColumn.actionRowProps. Undefined
  // when the game is won or the user can still keep guessing.
  onRevealSolution?: () => void
  proximityHints?: Map<number, { score: number; word: string }>
}

// Local chrono formatter — mm:ss (e.g. 125 -> "2:05"). Mirrors
// GuessInput.tsx:31 shape; kept inline to avoid a shared helper per
// Phase 10.2 D-01b (prop-drill, no shared hooks).
function formatChrono(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
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
  onDuelCreate,
  streak = null,
  username = null,
  favoriteBadge = null,
  revealAll = false,
  onRevealSolution,
  proximityHints,
}: NewGameScreenProps) {
  // Phase 10.3 P4 — ResultModal open-state. Opened by the new TitleHero
  // "Voir le résultat" banner via onOpenResult. TitleHero is consumed
  // indirectly via CenterArticle; pass onOpenResult through to it below.
  const [resultOpen, setResultOpen] = useState(false)

  // Phase 12 / Plan 05 — defeat-state ResultModal auto-open trigger
  // (Open Q1 recommendation b). When page-level `revealAll` flips true
  // and the user hasn't won, open the result modal exactly once. The
  // prev-prop-in-state pattern (React docs §"Adjusting state when a
  // prop changes") guards against re-firing if the modal is closed.
  const [revealAllSeen, setRevealAllSeen] = useState(false)
  if (revealAll && !gameState.won && !revealAllSeen) {
    setRevealAllSeen(true)
    setResultOpen(true)
  }
  if (!revealAll && revealAllSeen) {
    setRevealAllSeen(false)
  }

  const chrono = formatChrono(elapsed)
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

  // foundWordsByRecency: found guesses raw .word, most-recent-first.
  // gameState.guesses is already newest-first (new entries are prepended in
  // page.tsx via [{word, found}, ...prev.guesses]) — no .reverse() needed.
  const foundWordsByRecency = useMemo(() => {
    return gameState.guesses
      .filter((g) => g.found)
      .map((g) => g.word)
  }, [gameState.guesses])

  // triedSet: normalized values for ALL guesses (found + missed) — duplicate guard
  const triedSet = useMemo(() => {
    const s = new Set<string>()
    for (const g of gameState.guesses) s.add(normalize(g.word))
    return s
  }, [gameState.guesses])

  // triedWordsByRecency: ALL guesses (found + missed) raw .word, most-recent-first.
  // Source for ArrowUp/Down history navigation in GuessInput.
  const triedWordsByRecency = useMemo(() => {
    return gameState.guesses.map((g) => g.word)
  }, [gameState.guesses])

  // missed entries (most recent first) — gameState.guesses is already newest-first
  const missed = useMemo<MissedWordEntry[]>(() => {
    return gameState.guesses
      .filter((g) => !g.found)
      .map((g) => ({ display: g.word, normalized: normalize(g.word) }))
  }, [gameState.guesses])

  // foundEntries — include occurrences count per word from revealed article tokens.
  // Uses wordsMatch (mirrors the server matching logic) so morphological variants
  // like "règner" correctly count tokens containing "règne". Only visible (revealed)
  // tokens are counted since unrevealed tokens have value="" and can't be matched.
  const foundEntries = useMemo<FoundWordEntry[]>(() => {
    return foundWordsByRecency.map((w) => {
      const variants = splitOnApostrophe(w)
      const occurrences = gameState.tokens.filter(t => {
        // Unrevealed tokens have value="" (server-masked). In the new-design path
        // `visible` is not set on reveal — check t.value instead.
        if (t.type !== 'word' || t.isStopword || !t.value) return false
        const tokenClean = t.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, '')
        return variants.some(v => wordsMatch(v, tokenClean))
      }).length
      return { display: w, normalized: normalize(w), occurrences }
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
    <>
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
                triedWordsByRecency,
                triedSet,
                onReveal: handleReveal,
                onMiss,
                gameId: gameState.gameId,
                lang,
                disabled: false,
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
            onOpenResult={() => setResultOpen(true)}
            proximityHints={proximityHints}
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
              triedWordsByRecency,
              triedSet,
              onReveal: handleReveal,
              onMiss,
              gameId: gameState.gameId,
              lang,
              disabled: false,
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
              onDuelCreate,
              onRevealSolution,
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
            onOpenResult={() => setResultOpen(true)}
            proximityHints={proximityHints}
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
    {/* Phase 10.3 P4 — ResultModal rendered as sibling of the main grid so
        its z-index overlays everything. `open` gate keeps it null-rendered
        until the user clicks the TitleHero "Voir le résultat" banner. */}
    <ResultModal
      open={resultOpen}
      onClose={() => setResultOpen(false)}
      gameState={gameState}
      chrono={chrono}
      streak={streak}
      lang={lang}
      username={username}
      favoriteBadge={favoriteBadge}
    />
    </>
  )
}
