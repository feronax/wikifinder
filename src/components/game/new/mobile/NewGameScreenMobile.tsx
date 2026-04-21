'use client'

import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import { useRevealAnimation } from '@/hooks/useRevealAnimation'
import { useOccurrenceCycle } from '@/hooks/useOccurrenceCycle'
import { useKeyboardInset } from '@/hooks/useKeyboardInset'
import { useMobileTab, type MobileTab } from '@/hooks/useMobileTab'
import MobileShell from '@/components/game/new/mobile/MobileShell'
import MobileChipStrip from '@/components/game/new/mobile/MobileChipStrip'
import FixedBottomInput from '@/components/game/new/mobile/FixedBottomInput'
import TitleHero from '@/components/game/new/TitleHero'
import ArticleBody from '@/components/game/new/ArticleBody'
import StatsCard from '@/components/game/new/StatsCard'
import RightTriedColumn from '@/components/game/new/RightTriedColumn'
import type { FoundWordEntry } from '@/components/game/new/TriedWordRow'
import type { MissedWordEntry } from '@/components/game/new/RightTriedColumn'
import { normalize } from '@/lib/matching'
import type { GameState } from '@/app/game/types'

/**
 * NewGameScreenMobile — mobile orchestrator for the Phase-10 3-tab layout.
 *
 * Composition:
 *   - MobileShell (Plan 04) provides chrome: sticky top bar + BurgerDrawer + BottomTabBar
 *   - 3 tab panels (Jeu / Mots / Stats) rendered as siblings with display:none swaps
 *     per RESEARCH Pattern 3 (NOT unmount — D-05 scroll restoration requires preserved DOM)
 *   - FixedBottomInput (Plan 04) floats over every tab — SIBLING of panels, not nested
 *     (Pitfall 5: no position:relative ancestor on the article tree)
 *
 * Hook wiring (each mounted ONCE — Pitfall 7):
 *   - useKeyboardInset: writes --wf-kb-inset to <html>, returns { inset, isOpen }
 *   - useMobileTab: persists active tab to sessionStorage keyed by pageId
 *   - useRevealAnimation, useOccurrenceCycle: reused Phase-9 hooks (same as desktop)
 *
 * Phase-9 component reuse (byte-identical — no modifications):
 *   - TitleHero, ArticleBody, StatsCard, RightTriedColumn
 *
 * Scroll restoration (D-05):
 *   - Per-tab scrollTop captured in useRef<Map> BEFORE setActiveTab
 *   - Restored in useLayoutEffect AFTER activeTab change (pre-paint)
 */

export interface NewGameScreenMobileProps {
  gameState: GameState
  input: string
  setInput: (v: string) => void
  elapsed: number
  lang: 'fr' | 'en'
  onLangChange: (next: 'fr' | 'en') => void
  onMiss: (rawWord: string) => void
  onRevealHandled?: (normalizedWord: string, rawWord: string) => void
}

export default function NewGameScreenMobile({
  gameState,
  input,
  setInput,
  elapsed,
  lang,
  onLangChange,
  onMiss,
  onRevealHandled,
}: NewGameScreenMobileProps) {
  const reveal = useRevealAnimation()
  const cycle = useOccurrenceCycle()
  const { isOpen: keyboardOpen } = useKeyboardInset()

  // Derived pageId for deterministic mask-width seeding + mobile-tab persistence.
  const pageId: string = useMemo(() => {
    const pd = gameState.pageData
    return String(pd?.id ?? pd?.date ?? gameState.gameId ?? 'default')
  }, [gameState.pageData, gameState.gameId])

  const { activeTab, setActiveTab } = useMobileTab(pageId)

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

  // foundEntries — exclude stopwords (see NewGameScreen.tsx note: stopword
  // "ne" collides with guess "né" after normalize() strips accents).
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
    return gameState.tokens.filter((t) => t.type === 'word' && !t.isStopword)
      .length
  }, [gameState.tokens])

  // Per-tab scroll position memory (D-05). Scroll top is captured per tab
  // on the OUTGOING tab before the swap and restored on the INCOMING tab
  // after activeTab commits (useLayoutEffect — runs before paint).
  const scrollPosRef = useRef<Map<MobileTab, number>>(new Map())
  const jeuRef = useRef<HTMLDivElement | null>(null)
  const motsRef = useRef<HTMLDivElement | null>(null)
  const statsRef = useRef<HTMLDivElement | null>(null)
  const panelRefs: Record<MobileTab, React.RefObject<HTMLDivElement | null>> = {
    jeu: jeuRef,
    mots: motsRef,
    stats: statsRef,
  }

  const handleTabChange = useCallback(
    (next: MobileTab) => {
      const out = panelRefs[activeTab].current
      if (out) scrollPosRef.current.set(activeTab, out.scrollTop)
      setActiveTab(next)
    },
    // panelRefs is a stable ref-object map; eslint-react-hooks can safely
    // ignore it, but including activeTab + setActiveTab covers the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab, setActiveTab],
  )

  useLayoutEffect(() => {
    const el = panelRefs[activeTab].current
    if (el) el.scrollTop = scrollPosRef.current.get(activeTab) ?? 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Reveal + cycle handlers — mirror NewGameScreen.tsx:110-126 verbatim.
  const handleReveal = useCallback(
    (normalizedWord: string, rawWord: string) => {
      reveal.trigger(normalizedWord)
      onRevealHandled?.(normalizedWord, rawWord)
    },
    [reveal, onRevealHandled],
  )

  const handleCycle = useCallback(
    (w: string) => {
      cycle.resetOthers(w)
      cycle.cycle(w)
    },
    [cycle],
  )

  // Padding-bottom compensation for fixed input card (~76px incl. borders/shadow)
  // + tab bar (56px) + 16px breathing room + iOS safe-area-inset-bottom.
  const panelPaddingBottom =
    'calc(76px + 56px + 16px + env(safe-area-inset-bottom, 0px))'

  const panelBaseStyle = (tab: MobileTab): React.CSSProperties => ({
    display: tab === activeTab ? 'block' : 'none',
    overflowY: 'auto',
    height: '100%',
    paddingBottom: panelPaddingBottom,
  })

  return (
    <MobileShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
      keyboardOpen={keyboardOpen}
      lang={lang}
      onLangChange={onLangChange}
    >
      {/* Jeu tab — TitleHero + StatsCard progress + chip strip + ArticleBody */}
      <div ref={jeuRef} style={panelBaseStyle('jeu')}>
        <div style={{ padding: '16px 16px 0' }}>
          <TitleHero
            titleWords={gameState.titleWords}
            pageId={pageId}
            lang={lang}
            attemptsCount={gameState.guessCount}
          />
          <StatsCard
            elapsed={elapsed}
            attemptsCount={gameState.guessCount}
            foundCount={foundEntries.length}
            totalRevealableTokens={totalRevealableTokens}
            lang={lang}
          />
        </div>
        <MobileChipStrip found={foundEntries} onChipClick={handleCycle} />
        <div style={{ padding: '0 16px' }}>
          <ArticleBody
            tokens={gameState.tokens}
            pageId={pageId}
            foundSet={foundSet}
            justRevealedWord={reveal.justRevealed}
            highlightedWord={cycle.highlighted?.word ?? null}
            lang={lang}
          />
        </div>
      </div>

      {/* Mots tab — reuse Phase-9 RightTriedColumn verbatim (D-06) */}
      <div ref={motsRef} style={panelBaseStyle('mots')}>
        <div style={{ padding: 16 }}>
          <RightTriedColumn
            found={foundEntries}
            missed={missed}
            onCycle={handleCycle}
            lang={lang}
          />
        </div>
      </div>

      {/* Stats tab — reuse Phase-9 TitleHero + StatsCard (D-07) */}
      <div ref={statsRef} style={panelBaseStyle('stats')}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: 16,
          }}
        >
          <TitleHero
            titleWords={gameState.titleWords}
            pageId={pageId}
            lang={lang}
            attemptsCount={gameState.guessCount}
          />
          <StatsCard
            elapsed={elapsed}
            attemptsCount={gameState.guessCount}
            foundCount={foundEntries.length}
            totalRevealableTokens={totalRevealableTokens}
            lang={lang}
          />
        </div>
      </div>

      {/* Sibling of panels — NOT nested. Pitfall 5: no relative ancestor. */}
      <FixedBottomInput
        input={input}
        setInput={setInput}
        foundWordsByRecency={foundWordsByRecency}
        triedSet={triedSet}
        onReveal={handleReveal}
        onMiss={onMiss}
        gameId={gameState.gameId ?? null}
        lang={lang}
        disabled={gameState.won}
      />
    </MobileShell>
  )
}
