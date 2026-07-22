'use client'

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
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
import ResultModal from '@/components/game/new/ResultModal'
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
  // Phase 10.3-08 — mobile Actions reduced to single Défier button
  // (Indice + Abandonner removed per UAT scope change, Gaps B + C).
  onDuelCreate: () => Promise<void>
  // Phase 10.3-09 (Gap A) — pseudo + badge row in ResultModal.
  username?: string | null
  favoriteBadge?: string | null
  // Phase 12 / Plan 05 — pass-through callbacks for OnboardingModal +
  // FeedbackModal entry points; opened by MobileShell burger drawer
  // items. Required (page.tsx always supplies them in the newDesignOn
  // branch).
  onOpenOnboarding: () => void
  onOpenFeedback: () => void
  // Phase 12 / Plan 05 — defeat-state ResultModal trigger. Page-level
  // `revealAll` flag is plumbed through so the orchestrator can
  // auto-open the result modal when revealAll && !won (Open Q1 b).
  revealAll?: boolean
  // Phase 13 / Plan 04 (D-12, MOD-03) — defeat "Voir la solution" CTA.
  // Forwarded to MobileShell where it renders inside the burger drawer
  // Actions section (parity with desktop ActionRow defeat CTA).
  onRevealSolution?: () => void
  proximityHints?: Map<number, { score: number; word: string }>
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
  onDuelCreate,
  username = null,
  favoriteBadge = null,
  onOpenOnboarding,
  onOpenFeedback,
  revealAll = false,
  onRevealSolution,
  proximityHints,
}: NewGameScreenMobileProps) {
  const reveal = useRevealAnimation()
  const cycle = useOccurrenceCycle()
  const { isOpen: keyboardOpen } = useKeyboardInset()

  // Phase 10.3 P4 — ResultModal open-state (mirror of desktop NewGameScreen).
  // Opened by the TitleHero "Voir le résultat" banner in the Jeu tab via
  // onOpenResult; rendered as sibling of MobileShell so z-index 200 overlays
  // both the 3-tab panels and the FixedBottomInput.
  const [resultOpen, setResultOpen] = useState(false)

  // Phase 12 / Plan 05 — defeat-state ResultModal auto-open trigger
  // (Open Q1 recommendation b). When the page-level `revealAll` flag
  // flips true and the user hasn't won, surface the defeat ResultModal
  // exactly once. Hooks-strict: prev-prop-in-state guards against
  // re-firing when the modal is later closed manually.
  const [revealAllSeen, setRevealAllSeen] = useState(false)
  if (revealAll && !gameState.won && !revealAllSeen) {
    setRevealAllSeen(true)
    setResultOpen(true)
  }
  if (!revealAll && revealAllSeen) {
    setRevealAllSeen(false)
  }

  // Streak fetch (D-01/D-01a/D-01b): inline — no shared hook. Narrower than
  // Header.tsx:59-77 (no profile fetch; we only need streak for the pill).
  // Unauthed / fetch-failure paths leave streak at 0, hiding the pill.
  const [streak, setStreak] = useState(0)
  const [isAuthed, setIsAuthed] = useState(false)
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setIsAuthed(true)
        fetch('/api/game/streak')
          .then((r) => r.json())
          .then((d) => setStreak(d.streak || 0))
          .catch(() => {
            /* silent — streak stays 0 */
          })
      }
    })
  }, [])

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

  // foundWordsByRecency: found guesses raw .word, most-recent-first.
  // gameState.guesses is already newest-first (page.tsx prepends new entries
  // via [{word, found}, ...prev.guesses]) — no .reverse() needed.
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

  // Per-tab scroll restoration (old D-05) was removed: the tab panels are not
  // overflow scroll containers — the window scrolls — so panel.scrollTop was
  // always 0 and the save/restore was a no-op. setActiveTab is passed straight
  // through to MobileShell.

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
    paddingBottom: panelPaddingBottom,
  })

  // Inline chrono formatter — mm:ss (mirror of NewGameScreen.formatChrono).
  const chronoM = Math.floor(elapsed / 60)
  const chronoS = elapsed % 60
  const chrono = `${chronoM}:${chronoS.toString().padStart(2, '0')}`

  return (
    <>
    <MobileShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      keyboardOpen={keyboardOpen}
      lang={lang}
      onLangChange={onLangChange}
      streak={streak}
      onDuelCreate={onDuelCreate}
      onOpenOnboarding={onOpenOnboarding}
      onOpenFeedback={onOpenFeedback}
      onRevealSolution={onRevealSolution}
      isAuthed={isAuthed}
    >
      {/* Jeu tab — TitleHero + StatsCard progress + chip strip + ArticleBody */}
      <div style={panelBaseStyle('jeu')}>
        <div style={{ padding: '12px 16px 12px' }}>
          <TitleHero
            titleWords={gameState.titleWords}
            pageId={pageId}
            lang={lang}
            attemptsCount={gameState.guessCount}
            onOpenResult={() => setResultOpen(true)}
            compact
          />
          <StatsCard
            elapsed={elapsed}
            attemptsCount={gameState.guessCount}
            foundCount={foundEntries.length}
            totalRevealableTokens={totalRevealableTokens}
            lang={lang}
            compact
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
            proximityHints={proximityHints}
          />
        </div>
      </div>

      {/* Mots tab — reuse Phase-9 RightTriedColumn verbatim (D-06) */}
      <div style={panelBaseStyle('mots')}>
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
      <div style={panelBaseStyle('stats')}>
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
            onOpenResult={() => setResultOpen(true)}
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
        triedWordsByRecency={triedWordsByRecency}
        triedSet={triedSet}
        onReveal={handleReveal}
        onMiss={onMiss}
        gameId={gameState.gameId ?? null}
        lang={lang}
        disabled={false}
      />
    </MobileShell>
    {/* Phase 10.3 P4 — ResultModal rendered as top-level sibling of
        MobileShell so its z-index 200 overlays every tab panel and the
        FixedBottomInput. Opened by the TitleHero "Voir le résultat"
        banner; closed via Esc, backdrop click, or close-X. */}
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
