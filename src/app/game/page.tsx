'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { isStopword } from '@/lib/wikipedia'
import { normalize, wordsMatch } from '@/lib/matching'
import { setWordHashSet, isWordInArticle } from '@/lib/client-hash'
import { Menu } from 'lucide-react'
import { useIsMobile, calculateScore } from '@/lib/utils'
import { useSafeTimeout } from '@/lib/use-safe-timeout'
import Header from '@/components/Header'
import Loader from '@/components/Loader'
import TokenRenderer from '@/components/game/TokenRenderer'
import GuessInput from '@/components/game/GuessInput'
import TitleDisplay from '@/components/game/TitleDisplay'
import SurvivalLivesIndicator from '@/components/game/SurvivalLivesIndicator'
import SurvivalChainBadge from '@/components/game/SurvivalChainBadge'
import GiveUpButton from '@/components/game/GiveUpButton'
import SurvivalResultsPanel from '@/components/game/SurvivalResultsPanel'
import SurvivalShareCard from '@/components/game/SurvivalShareCard'
import DailyShareCard from '@/components/game/DailyShareCard'
import OnboardingOverlay from '@/components/onboarding/OnboardingOverlay'
import PushOptInSheet from '@/components/notifications/PushOptInSheet'
import ChallengeButton from '@/components/duel/ChallengeButton'
import DuelToast from '@/components/duel/DuelToast'
import NewGameScreen from '@/components/game/new/NewGameScreen'
import NewGameScreenMobile from '@/components/game/new/mobile/NewGameScreenMobile'
import NewDesignHeader from '@/components/game/new/NewDesignHeader'
import OnboardingModal from '@/components/game/new/modals/OnboardingModal'
import FeedbackModal from '@/components/game/new/modals/FeedbackModal'
import { GameState, translations } from './types'

// Survival-mode translations (UI-SPEC §Copywriting Contract — FR + EN parity)
const survivalTranslations = {
    fr: {
        livesAria: (n: number, total: number) => `Vies restantes : ${n} sur ${total}`,
        chain: (n: number) => `Chaîne ${n}`,
        chainAria: (n: number) => `Longueur de la chaîne : ${n} articles`,
        giveUp: {
            label: 'Abandonner l\u2019article',
            dialog: {
                title: 'Abandonner cet article ?',
                body: (nextLives: number) => `Tu perds une vie et passes au suivant. Il te restera ${nextLives} vie(s).`,
                confirm: 'Oui, abandonner',
                cancel: 'Continuer',
            },
        },
        results: {
            headline: 'Run terminée',
            scoreLabel: 'Score',
            metaLine: (n: number, duration: string) => `Chaîne : ${n} articles · Durée : ${duration}`,
            shareCta: 'Partager',
            replayCta: 'Relancer un Survival',
            trailAria: (total: number, cleared: number, gaveUp: number, score: number) =>
                `Chaîne Wikifinder Survival de ${total} articles : ${cleared} réussis, ${gaveUp} abandons. Score ${score}.`,
        },
        startFailed: 'Impossible de lancer la run. Réessaye dans un instant.',
        startCta: 'Lancer un Survival',
    },
    en: {
        livesAria: (n: number, total: number) => `Lives remaining: ${n} of ${total}`,
        chain: (n: number) => `Chain ${n}`,
        chainAria: (n: number) => `Chain length: ${n} articles`,
        giveUp: {
            label: 'Give up this article',
            dialog: {
                title: 'Give up this article?',
                body: (nextLives: number) => `You\u2019ll lose a life and move to the next article. You\u2019ll have ${nextLives} life (lives) left.`,
                confirm: 'Yes, give up',
                cancel: 'Keep trying',
            },
        },
        results: {
            headline: 'Run ended',
            scoreLabel: 'Score',
            metaLine: (n: number, duration: string) => `Chain: ${n} articles · Duration: ${duration}`,
            shareCta: 'Share',
            replayCta: 'Play another run',
            trailAria: (total: number, cleared: number, gaveUp: number, score: number) =>
                `Wikifinder Survival chain of ${total} articles: ${cleared} cleared, ${gaveUp} given up. Score ${score}.`,
        },
        startFailed: 'Couldn\u2019t start the run. Try again in a moment.',
        startCta: 'Start Survival',
    },
}

export default function GamePage() {
    const [gameState, setGameState] = useState<GameState | null>(null)
    const [revealAll, setRevealAll] = useState(false)
    const [allWordsCache, setAllWordsCache] = useState<Map<number, string> | null>(null)
    const [frozenElapsed, setFrozenElapsed] = useState<number | null>(null)
    const [lang, setLang] = useState<'fr' | 'en'>('fr')
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [input, setInput] = useState('')
    const [inputError, setInputError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [startedAt, setStartedAt] = useState<Date | null>(null)
    const [elapsed, setElapsed] = useState(0)
    const [user, setUser] = useState<any>(null)
    const [username, setUsername] = useState<string | null>(null)
    const [favoriteBadge, setFavoriteBadge] = useState<string | null>(null)
    const [clickedWord, setClickedWord] = useState<{ word: string, index: number } | null>(null)
    const [inputHistory, setInputHistory] = useState<string[]>([])
    const [inputHistoryIndex, setInputHistoryIndex] = useState<number>(-1)
    const [hintTokenIndex, setHintTokenIndex] = useState<number | null>(null)
    const [streak, setStreak] = useState<number | null>(null)
    const [shareCopied, setShareCopied] = useState(false)
    const [challengeCopied, setChallengeCopied] = useState(false)
    const [justRevealedTokens, setJustRevealedTokens] = useState<Set<number>>(new Set())
    const [justRevealedTitle, setJustRevealedTitle] = useState<Set<number>>(new Set())
    const [proximityHints, setProximityHints] = useState<Map<number, { score: number; word: string }>>(new Map())
    const [pendingRevealLength, setPendingRevealLength] = useState<number | null>(null)
    const [badgeNotifications, setBadgeNotifications] = useState<{ key: string; name: string; icon: string; rarity: string }[]>([])
    const [seasonUpdate, setSeasonUpdate] = useState<{ seasonName: string; totalScore: number; rank: string; rankedScore: number } | null>(null)
    const [duelToast, setDuelToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)
    // Phase 12 / Plan 05 — modal open-state for the new-design tree.
    // Hoisted to the top with sibling useState hooks (rules-of-hooks);
    // unused on the legacy/!newDesignOn path. Pitfall 5: setState here
    // does NOT bubble re-renders through ArticleBody during reveals —
    // the values only change on modal open/close (post-win or burger
    // tap), never during the sacred guess pipeline. Reveal-latency CI
    // gate (e2e/daily-game-new-ui.spec.ts) is the binding non-regression.
    const [onboardingOpen, setOnboardingOpen] = useState(false)
    const [feedbackOpen, setFeedbackOpen] = useState(false)
    // Phase 13 / Plan 03 — POL-02 ARIA announcer (D-05/D-06). Single page-
    // level state fed by both the body-token reveal site and the title-letter
    // reveal site. Synchronous setState IS the debounce: each guess produces
    // exactly one new string and the live region announces on string change.
    const [revealAnnouncement, setRevealAnnouncement] = useState<string>('')
    const [duelId, setDuelId] = useState<string | null>(null)
    // Phase 11 gap-fix: distinguish ?duel= URL param from a successfully loaded
    // duel-mode game. The "Duel terminé" banner must only show when the actual
    // server-side game is mode='duel' — otherwise a stale duel param + an
    // existing daily game produces a misleading banner on the daily completion.
    const [isDuelGame, setIsDuelGame] = useState(false)

    // Survival mode state (Plan 03-04 — only populated when mode=survival)
    const [isSurvival, setIsSurvival] = useState(false)
    const [survivalState, setSurvivalState] = useState<{
        gameId: string | null   // null for anonymous
        livesRemaining: number
        chainLength: number
        language: 'fr' | 'en'
        anonymous: boolean
    } | null>(null)
    const [survivalResults, setSurvivalResults] = useState<{
        score: number
        chainLength: number
        chain: { outcome: 'completed' | 'gave_up' }[]
        durationSec: number
        shareText: string
    } | null>(null)

    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const safeSetTimeout = useSafeTimeout()
    // HARD-01: single-in-flight queue — serializes POST /api/game/guess
    // behind any prior in-flight POST. Optimistic UI fires BEFORE this chain
    // is touched (sacred latency); the chain only throttles the network call.
    const submitChainRef = useRef<Promise<unknown>>(Promise.resolve())
    // Phase 10.3 D-01: single-fire guard for the new-design win-trigger block
    // inside syncGuessWithServer. The legacy path uses an inline alreadyWon
    // closure (page.tsx:794); the new-design path runs through a different
    // code route so it needs its own terminal-state ref. Never reset —
    // winning a game is terminal for the session.
    const prevWonRef = useRef(false)

    // Timer
    useEffect(() => {
        if (!startedAt || gameState?.won) return
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
        }, 1000)
        return () => clearInterval(interval)
    }, [startedAt, gameState?.won])

    // Cleanup hint timer on unmount (HARD-06: hintTimerRef has clear-on-resubmit
    // logic but no unmount cleanup — covers tab close while a hint is showing).
    useEffect(() => {
        return () => {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
        }
    }, [])

    // Onboarding modal first-visit auto-show was removed: the home page (/)
    // now hosts the same tutorial content, so popping the modal on /game is
    // redundant. The burger-menu "Help" entry still opens it manually via
    // setOnboardingOpen(true).
    const inputRef = useRef<HTMLInputElement>(null)
    const supabase = createSupabaseBrowserClient()
    const isMobile = useIsMobile()
    const t = translations[lang]

    const [authReady, setAuthReady] = useState(false)

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data }) => {
            setUser(data.user)
            if (data.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('username, favorite_badge')
                    .eq('id', data.user.id)
                    .single()
                if (profile) {
                    setUsername(profile.username)
                    setFavoriteBadge(profile.favorite_badge || null)
                }
            }
            setAuthReady(true)
        }).catch(() => {
            // Don't strand the loader if auth.getUser rejects (PWA cookie jar, network, etc.)
            setAuthReady(true)
        })
    }, [])

    useEffect(() => {
        // Gate loader on auth resolution — PWA standalone mode can race the auth
        // cookie vs the loader, producing an anon /api/game/start call that
        // returns a different game than the server has for the signed-in user.
        if (!authReady) return
        const params = new URLSearchParams(window.location.search)
        const dateParam = params.get('date')
        const langParam = params.get('lang') as 'fr' | 'en' | null
        const modeParam = params.get('mode') as 'daily' | 'survival' | null
        const duelParam = params.get('duel')
        const survival = modeParam === 'survival'
        if (langParam && langParam !== lang && (langParam === 'fr' || langParam === 'en')) {
            setLang(langParam)
            return
        }
        if (survival) {
            setIsSurvival(true)
            loadSurvival(lang)
            return
        }
        setIsSurvival(false)
        if (duelParam) {
            setDuelId(duelParam)
            loadDuelGame(duelParam, lang)
            return
        }
        setDuelId(null)
        setIsDuelGame(false)
        loadGame(lang, dateParam || undefined)
    }, [lang, authReady])

    // Phase 6 fix: wire /game?duel={roomId} to the server's duel-start branch.
    // The server handler (api/game/start handleDuelStart) creates a mode='duel'
    // games row and UPDATEs room_players.game_id; without this client call the
    // joiner's game was being created as mode='daily' and the duel page stayed
    // stuck in 'lobby' forever (prod bug reported 2026-04-20).
    async function loadDuelGame(roomId: string, l: 'fr' | 'en') {
        setLoading(true)
        setLoadError(null)
        setRevealAll(false)
        setClickedWord(null)
        setHintTokenIndex(null)
        setIsDuelGame(false)
        try {
            const startRes = await fetch(`/api/game/start?duel=${encodeURIComponent(roomId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
            })
            if (!startRes.ok) {
                setLoadError(l === 'fr' ? 'Impossible de démarrer le duel.' : "Couldn't start the duel.")
                setLoading(false)
                return
            }
            const startData = await startRes.json()
            const game = startData.game
            const gameId = game?.id || null
            // Load article tokens for this room's page+lang
            const todayRes = await fetch(`/api/game/today?lang=${l}&pageId=${encodeURIComponent(game.page_id)}${gameId ? `&gameId=${gameId}` : ''}`)
            if (!todayRes.ok) {
                setLoadError(l === 'fr' ? 'Impossible de charger l\u2019article du duel.' : "Couldn't load the duel article.")
                setLoading(false)
                return
            }
            const data = await todayRes.json()
            const previousGuesses: string[] = []
            if (gameId && game.guess_count > 0) {
                const gres = await fetch(`/api/game/guesses?gameId=${gameId}`)
                if (gres.ok) {
                    const gdata = await gres.json()
                    previousGuesses.push(...(gdata.guesses || []))
                }
            }
            const guessesWithStatus = previousGuesses.map(word => {
                const found = data.tokens.some((token: any) =>
                    token.type === 'word' && token.visible && !token.isStopword && token.value &&
                    wordsMatch(word, token.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, ''))
                )
                return { word, found }
            })
            setGameState({
                tokens: data.tokens,
                titleWords: data.titleWords,
                guesses: guessesWithStatus.slice().reverse(),
                guessCount: game.guess_count ?? 0,
                won: game.completed === true,
                pageData: data,
                gameId,
            })
            // Mark this as a confirmed duel-mode game (server-side mode='duel').
            setIsDuelGame(game?.mode === 'duel')
            if (data.wordHashSet) setWordHashSet(data.wordHashSet)
            const start = new Date(game.started_at || Date.now())
            setStartedAt(start)
            setElapsed(Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000)))
            setFrozenElapsed(null)
        } catch {
            setLoadError(l === 'fr' ? 'Impossible de démarrer le duel.' : "Couldn't start the duel.")
        }
        setLoading(false)
    }

    async function loadSurvival(l: 'fr' | 'en') {
        setLoading(true)
        setLoadError(null)
        setRevealAll(false)
        setClickedWord(null)
        setHintTokenIndex(null)

        try {
            const res = await fetch('/api/survival/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lang: l }),
            })
            if (!res.ok) {
                setLoadError(survivalTranslations[l].startFailed)
                setLoading(false)
                return
            }
            const body = await res.json()
            setSurvivalState({
                gameId: body.gameId ?? null,
                livesRemaining: body.livesRemaining,
                chainLength: body.chainLength,
                language: body.language,
                anonymous: !!body.anonymous,
            })
            setGameState({
                tokens: body.tokens,
                titleWords: body.titleWords,
                guesses: [],
                guessCount: 0,
                won: false,
                pageData: {
                    id: body.pageId,
                    wikipedia_url_fr: body.language === 'fr' ? body.wikipedia_url : undefined,
                    wikipedia_url_en: body.language === 'en' ? body.wikipedia_url : undefined,
                },
                gameId: body.gameId ?? null,
            })
            if (body.wordHashSet) {
                setWordHashSet(body.wordHashSet)
            }
            const start = new Date()
            setStartedAt(start)
            setElapsed(0)
            setFrozenElapsed(null)
        } catch {
            setLoadError(survivalTranslations[l].startFailed)
        }
        setLoading(false)
        safeSetTimeout(() => inputRef.current?.focus(), 100)
    }

    async function loadGame(l: 'fr' | 'en', date?: string) {
        setLoading(true)
        setLoadError(null)
        setRevealAll(false)
        setClickedWord(null)
        setHintTokenIndex(null)

        // 15s watchdog: if any fetch in this flow hangs (PWA SW stuck, network drop,
        // auth-cookie race mid-flight), surface a retry state rather than strand the
        // loader spinner. Reported 2026-04-20 — iOS PWA after login hung forever.
        const abortCtrl = new AbortController()
        const watchdog = setTimeout(() => abortCtrl.abort(), 15000)
        try {
        let todayUrl = `/api/game/today?lang=${l}`
        if (date) todayUrl += `&date=${date}`

        // Charge la page sans gameId d'abord pour obtenir le pageId
        const preRes = await fetch(todayUrl, { signal: abortCtrl.signal })
        if (!preRes.ok) {
            setLoadError(l === 'fr' ? 'Impossible de charger la partie du jour.' : 'Could not load today\'s game.')
            setLoading(false)
            clearTimeout(watchdog)
            return
        }
        const preData = await preRes.json()
        const pageId = preData.id

        // Start/restore la partie
        const startRes2 = await fetch('/api/game/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang: l, pageId }),
            signal: abortCtrl.signal,
        })
        const startData = await startRes2.json()
        const game = startData.game
        const gameId = game?.id || null

        // 2. Si partie existante avec des guesses, recharge les tokens avec restauration serveur
        let finalData = preData
        if (game && (game.guess_count > 0 || game.completed === true) && gameId) {
            const restoreUrl = `${todayUrl}&gameId=${gameId}`
            const restoreRes = await fetch(restoreUrl, { signal: abortCtrl.signal })
            if (restoreRes.ok) {
                finalData = await restoreRes.json()
            }

            // Récupère la liste des guesses pour l'historique
            const guessRes = await fetch(`/api/game/guesses?gameId=${gameId}`, { signal: abortCtrl.signal })
            const guessData = await guessRes.json()
            const previousGuesses: string[] = guessData.guesses || []

            // Détermine quels mots étaient trouvés en se basant sur les tokens révélés
            const guessesWithStatus = previousGuesses.map(word => {
                const found = finalData.tokens.some((token: any) =>
                    token.type === 'word' && token.visible && !token.isStopword && token.value &&
                    wordsMatch(word, token.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, ''))
                )
                return { word, found }
            })

            const finalState: GameState = {
                tokens: finalData.tokens,
                titleWords: finalData.titleWords,
                guesses: guessesWithStatus.slice().reverse(),
                guessCount: game.guess_count,
                won: game.completed,
                pageData: finalData,
                gameId,
            }

            setGameState(finalState)

            // Restaure les proximity hints
            if (finalData.proximityHints && finalData.proximityHints.length > 0) {
                const restored = new Map<number, { score: number; word: string }>()
                for (const h of finalData.proximityHints) {
                    restored.set(h.index, { score: h.score, word: h.word })
                }
                setProximityHints(restored)
            }

            if (finalState.won) {
                fetch('/api/game/streak').then(r => r.json()).then(d => setStreak(d.streak || 0))
            }
        } else {
            setGameState({
                tokens: finalData.tokens,
                titleWords: finalData.titleWords,
                guesses: [],
                guessCount: 0,
                won: false,
                pageData: finalData,
                gameId,
            })
        }

        // Charge le hash set pour la vérification instantanée côté client
        if (finalData.wordHashSet) {
            setWordHashSet(finalData.wordHashSet)
        }

        const timerStart = finalData.firstGuessAt || game?.started_at
        const start = timerStart ? new Date(timerStart) : new Date()
        setStartedAt(start)
        const initialElapsed = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000))
        setElapsed(initialElapsed)

        // Si la partie est déjà gagnée, figer le timer
        if (game?.completed && game?.duration_seconds) {
            setFrozenElapsed(game.duration_seconds)
        } else if (game?.completed) {
            setFrozenElapsed(initialElapsed)
        }
        setLoading(false)
        safeSetTimeout(() => inputRef.current?.focus(), 100)
        } catch (err: any) {
            // AbortError (watchdog tripped) or any network throw — surface retry state.
            if (err?.name === 'AbortError') {
                setLoadError(l === 'fr'
                    ? 'Le chargement a pris trop de temps. Réessaye.'
                    : 'Loading took too long. Please retry.')
            } else {
                setLoadError(l === 'fr'
                    ? 'Impossible de charger la partie du jour.'
                    : 'Could not load today\'s game.')
            }
            setLoading(false)
        } finally {
            clearTimeout(watchdog)
        }
    }

    // Survival give-up handler — rides submitChainRef (HARD-01 queue) per D-16.
    // Anonymous users have no gameId and get a disabled button (see HUD render),
    // so this is a no-op guard rather than a UX path.
    const handleSurvivalGiveUp = useCallback(() => {
        if (!survivalState || !survivalState.gameId) return
        const gameId = survivalState.gameId
        const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID() : undefined
        submitChainRef.current = submitChainRef.current
            .catch(() => {})
            .then(async () => {
                try {
                    const res = await fetch('/api/survival/give-up', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ gameId, idempotencyKey }),
                    })
                    if (!res.ok) return
                    const body = await res.json()
                    if (body.ended) {
                        // lives went to 0 — server inlined end-of-run payload
                        setSurvivalResults({
                            score: body.score,
                            chainLength: body.chainLength,
                            chain: body.chain,
                            durationSec: body.durationSec,
                            shareText: body.shareText,
                        })
                        setFrozenElapsed(elapsed)
                        return
                    }
                    // lives > 0 — server returned next article
                    setSurvivalState(s => s ? {
                        ...s,
                        livesRemaining: body.livesRemaining,
                        chainLength: body.chainLength,
                    } : s)
                    if (body.next) {
                        setGameState({
                            tokens: body.next.tokens,
                            titleWords: body.next.titleWords,
                            guesses: [],
                            guessCount: 0,
                            won: false,
                            pageData: {
                                id: body.next.pageId,
                                wikipedia_url_fr: survivalState.language === 'fr' ? body.next.wikipedia_url : undefined,
                                wikipedia_url_en: survivalState.language === 'en' ? body.next.wikipedia_url : undefined,
                            },
                            gameId,
                        })
                        if (body.next.wordHashSet) setWordHashSet(body.next.wordHashSet)
                        const start = new Date()
                        setStartedAt(start)
                        setElapsed(0)
                        setFrozenElapsed(null)
                    }
                } catch {
                    // Silent degrade — optimistic UI unaffected (we don't mutate pre-fetch)
                }
            })
    }, [survivalState, elapsed])

    // Chain-advance effect: after winning a survival article, fetch next article
    // via /api/survival/start (chain-advance branch for authed; fresh pick for anon).
    // CRITICAL: setTimeout 1200ms keeps this fully OUTSIDE the sacred <50ms
    // reveal window (Phase 2 D-10). The reveal-painted mark has long fired.
    useEffect(() => {
        if (!isSurvival || !gameState?.won || !survivalState || survivalResults) return
        const pageId = gameState.pageData?.id
        const language = survivalState.language
        const gameId = survivalState.gameId
        const timer = setTimeout(() => {
            const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID() : undefined
            submitChainRef.current = submitChainRef.current
                .catch(() => {})
                .then(async () => {
                    try {
                        const res = await fetch('/api/survival/start', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                lang: language,
                                gameId: gameId ?? undefined,
                                completedPageId: gameId ? pageId : undefined,
                                idempotencyKey,
                            }),
                        })
                        if (!res.ok) return
                        const body = await res.json()
                        setSurvivalState(s => s ? {
                            ...s,
                            livesRemaining: body.livesRemaining,
                            chainLength: body.chainLength,
                            anonymous: !!body.anonymous,
                            gameId: body.gameId ?? s.gameId,
                        } : s)
                        setGameState({
                            tokens: body.tokens,
                            titleWords: body.titleWords,
                            guesses: [],
                            guessCount: 0,
                            won: false,
                            pageData: {
                                id: body.pageId,
                                wikipedia_url_fr: language === 'fr' ? body.wikipedia_url : undefined,
                                wikipedia_url_en: language === 'en' ? body.wikipedia_url : undefined,
                            },
                            gameId: body.gameId ?? null,
                        })
                        if (body.wordHashSet) setWordHashSet(body.wordHashSet)
                        const start = new Date()
                        setStartedAt(start)
                        setElapsed(0)
                        setFrozenElapsed(null)
                    } catch {
                        // Silent degrade
                    }
                })
        }, 1200)
        return () => clearTimeout(timer)
    }, [gameState?.won, isSurvival, survivalState, survivalResults, gameState?.pageData?.id])

    function showHint(index: number) {
        if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
        setHintTokenIndex(index)
        hintTimerRef.current = setTimeout(() => setHintTokenIndex(null), 2000)
    }

    function scrollToOccurrence(word: string) {
        const normWord = normalize(word)
        const elements = Array.from(document.querySelectorAll('[data-word]')).filter(el =>
            wordsMatch(word, el.getAttribute('data-word') || '')
        )
        if (elements.length === 0) return
        elements.forEach(el => el.classList.remove('word-highlight'))
        setClickedWord(prev => {
            const nextIndex = prev?.word === normWord ? (prev.index + 1) % elements.length : 0
            const el = elements[nextIndex]
            const headerOffset = isMobile ? 220 : 160
            const elementPosition = (el as HTMLElement).getBoundingClientRect().top + window.scrollY
            window.scrollTo({ top: elementPosition - headerOffset, behavior: 'smooth' })
            void (el as HTMLElement).offsetWidth
            el.classList.add('word-highlight')
            safeSetTimeout(() => el.classList.remove('word-highlight'), 1200)
            return { word: normWord, index: nextIndex }
        })
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            handleGuess()
            return
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (inputHistory.length === 0) return
            const newIndex = inputHistoryIndex === -1 ? 0 : Math.min(inputHistoryIndex + 1, inputHistory.length - 1)
            setInputHistoryIndex(newIndex)
            setInput(inputHistory[newIndex])
            setInputError(null)
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (inputHistoryIndex <= 0) { setInputHistoryIndex(-1); setInput(''); return }
            const newIndex = inputHistoryIndex - 1
            setInputHistoryIndex(newIndex)
            setInput(inputHistory[newIndex])
            setInputError(null)
        }
    }

    async function handleGuess() {
        if (!gameState || submitting) return
        const word = input.trim()
        if (!word) return
        const clean = word.toLowerCase()

        setInputHistory(prev => [word, ...prev.filter(w => w !== word)])
        setInputHistoryIndex(-1)

        if (isStopword(clean, lang)) {
            setInput(''); setInputError(null); setTimeout(() => inputRef.current?.focus(), 0); return
        }

        if (gameState.guesses.some(g => wordsMatch(g.word, word))) {
            setInput('')
            setInputError(t.alreadyGuessed)
            setTimeout(() => inputRef.current?.focus(), 0)
            return
        }

        const alreadyWon = gameState.won

        // ========== RÉVÉLATION OPTIMISTE ==========
        // 1. Check instantané côté client via hash set (~1ms)
        const inArticle = await isWordInArticle(word)
        setInput('')
        setInputError(null)

        // 2. Affichage IMMÉDIAT du résultat — pas d'attente serveur
        if (inArticle) {
            // Narrow-window mark (D-08/D-09 clarification — Plan 02-05 option B):
            // `guess:reveal` measures render+paint ONLY, not keydown+validation+paint.
            // The synchronous work above and the `await isWordInArticle` microtask
            // are excluded — nothing visible happens during them, so they cannot
            // count toward "perceived latency" per CLAUDE.md's <50ms visible budget.
            performance.mark('guess:enter')
            // Anime les blocs de même longueur pendant l'attente serveur
            setPendingRevealLength(word.length)

            // Le mot est dans l'article — on update le guess count optimistiquement
            setGameState(prev => prev ? {
                ...prev,
                guesses: [{ word, found: true }, ...prev.guesses],
                guessCount: alreadyWon ? prev.guessCount : prev.guessCount + 1,
            } : prev)
        } else {
            // Le mot n'est pas dans l'article — ajouté à l'historique (en attente Wiktionary)
            setGameState(prev => prev ? {
                ...prev,
                guesses: [{ word, found: false }, ...prev.guesses],
                guessCount: alreadyWon ? prev.guessCount : prev.guessCount + 1,
            } : prev)
        }

        setTimeout(() => inputRef.current?.focus(), 0)

        // 3. Sync avec le serveur en BACKGROUND — transparent pour le joueur.
        //    HARD-01: generate a fresh idempotency key per Enter keypress
        //    and chain the POST behind any prior in-flight POST via
        //    submitChainRef. The optimistic UI is ALREADY on screen above
        //    (sacred path) — this queue only serializes the network call.
        //    crypto.randomUUID is native Web Crypto (browser + Android WebView 24+).
        //    If unavailable, omit the key — server treats as non-deduplicated
        //    (same as anonymous). Never fall back to Math.random (collision risk).
        const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : undefined
        const guessBody = {
            gameId: gameState.gameId,
            pageId: gameState.pageData.id,
            lang,
            word,
            elapsed,
            ...(idempotencyKey ? { idempotencyKey } : {}),
            ...(!gameState.gameId && !alreadyWon && { previousGuesses: gameState.guesses.map(g => g.word) }),
        }

        submitChainRef.current = submitChainRef.current
            .catch(() => {})  // earlier failure does not block this one
            .then(() => {
                performance.mark('guess:fetch-start')
                return fetch('/api/game/guess', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(guessBody),
                }).then(async res => {
                    performance.mark('guess:fetch-end')
                    const data = await res.json()

                    // Si le mot n'existe pas (Wiktionary), rollback le guess
                    if (data.wordNotFound) {
                        setInputError(t.wordNotFound)
                        setGameState(prev => prev ? {
                            ...prev,
                            guesses: prev.guesses.filter(g => g.word !== word),
                            guessCount: alreadyWon ? prev.guessCount : prev.guessCount - 1,
                        } : prev)
                        return
                    }

                    // Sync le guess count serveur si différent
                    if (data.guessCount !== null && data.guessCount !== undefined) {
                        setGameState(prev => prev ? {
                            ...prev,
                            guessCount: alreadyWon ? prev.guessCount : data.guessCount,
                        } : prev)
                    }

                    // Applique les tokens révélés par le serveur (valeurs réelles)
                    const { revealedTokens, revealedTitleIndices, won: isWon } = data

                    // Arrête l'animation pending
                    setPendingRevealLength(null)

                    // Rollback si le client pensait que le mot était dans l'article mais le serveur dit non
                    if ((!revealedTokens || revealedTokens.length === 0) && !data.isInText) {
                        setGameState(prev => prev ? {
                            ...prev,
                            guesses: prev.guesses.map(g => g.word === word ? { ...g, found: false } : g),
                        } : prev)
                    }

                    if (revealedTokens && revealedTokens.length > 0) {
                        const revealedTokenMap = new Map<number, string>()
                        for (const rt of revealedTokens) revealedTokenMap.set(rt.index, rt.value)
                        const revealedTitleMap = new Map<number, string>()
                        for (const rt of (revealedTitleIndices || [])) revealedTitleMap.set(rt.index, rt.value)

                        // Animations
                        setJustRevealedTokens(new Set(revealedTokenMap.keys()))
                        safeSetTimeout(() => setJustRevealedTokens(new Set()), 700)
                        // Phase 13 ARIA announcer — debounced one-shot per guess (D-05/D-06)
                        const _revealCount = revealedTokens.length
                        const _firstWord = revealedTokens[0]?.value ?? ''
                        setRevealAnnouncement(
                            _revealCount === 1
                                ? (lang === 'fr' ? `Révélé : ${_firstWord}` : `Revealed: ${_firstWord}`)
                                : (lang === 'fr' ? `Révélé : ${_revealCount} mots` : `Revealed: ${_revealCount} words`)
                        )
                        if (revealedTitleIndices && revealedTitleIndices.length > 0) {
                            setJustRevealedTitle(new Set<number>(revealedTitleIndices.map((rt: { index: number }) => rt.index)))
                            safeSetTimeout(() => setJustRevealedTitle(new Set()), 900)
                            // Phase 13 ARIA announcer — title-letter reveal (same announcer per D-06)
                            const _titleLetterCount = revealedTitleIndices.length
                            setRevealAnnouncement(
                                _titleLetterCount === 1
                                    ? (lang === 'fr' ? `Lettre du titre révélée : ${revealedTitleIndices[0].value}` : `Title letter revealed: ${revealedTitleIndices[0].value}`)
                                    : (lang === 'fr' ? `${_titleLetterCount} lettres du titre révélées` : `${_titleLetterCount} title letters revealed`)
                            )
                        }

                        setGameState(prev => {
                            if (!prev) return prev
                            return {
                                ...prev,
                                tokens: prev.tokens.map(token =>
                                    revealedTokenMap.has(token.index)
                                        ? { ...token, value: revealedTokenMap.get(token.index)!, visible: true }
                                        : token
                                ),
                                titleWords: prev.titleWords.map(tw =>
                                    revealedTitleMap.has(tw.index)
                                        ? { ...tw, value: revealedTitleMap.get(tw.index)!, revealed: true }
                                        : tw
                                ),
                                won: isWon || prev.won,
                            }
                        })
                    }

                    if (isWon && !alreadyWon) {
                        // Fige le chrono au moment de la victoire
                        setFrozenElapsed(elapsed)
                        fetch('/api/game/streak').then(r => r.json()).then(d => setStreak(d.streak || 0))
                        // Lazy-load canvas-confetti au moment de la victoire (~30KB gzip hors bundle critique)
                        import('canvas-confetti').then(({ default: confetti }) => {
                            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } })
                            safeSetTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.3 } }), 300)
                            safeSetTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.7 } }), 600)
                        })

                        // Badge unlock notifications
                        if (data.newBadges && data.newBadges.length > 0) {
                            data.newBadges.forEach((badge: { key: string; name: string; icon: string; rarity: string }, idx: number) => {
                                safeSetTimeout(() => {
                                    setBadgeNotifications(prev => [...prev, badge])
                                    safeSetTimeout(() => {
                                        setBadgeNotifications(prev => prev.filter(b => b.key !== badge.key))
                                    }, 3200)
                                }, idx * 800)
                            })
                        }

                        // Season ranked score
                        if (data.seasonUpdate) {
                            setSeasonUpdate(data.seasonUpdate)
                        }
                    }
                }).catch(() => {
                    // Erreur réseau silencieuse — le guess est déjà affiché localement
                })
            })

        // Proximity hints en background (uniquement si mot dans l'article)
        if (inArticle) {
            fetch('/api/game/proximity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: gameState.gameId,
                    pageId: gameState.pageData.id,
                    lang,
                    word,
                }),
            }).then(r => r.ok ? r.json() : { proximityHints: [] })
              .then((proxData: { proximityHints?: { index: number; score: number }[] }) => {
                const newHints = proxData.proximityHints
                if (!newHints || newHints.length === 0) return
                setProximityHints(prev => {
                    const next = new Map(prev)
                    for (const h of newHints) {
                        if (!next.has(h.index) || next.get(h.index)!.score < h.score) {
                            next.set(h.index, { score: h.score, word })
                        }
                    }
                    return next
                })
            }).catch(() => {})
        }
    }

    const titleScoreStyle = useMemo(() => {
        const baseStyle = {
            marginTop: 32, marginBottom: 28,
            backgroundColor: 'var(--surface)', borderRadius: 12,
            border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
            display: 'flex', gap: 16,
        };

        if (isMobile) {
            return {
                ...baseStyle,
                flexDirection: 'column' as const,
                alignItems: 'center',
                padding: '12px 16px',
                gap: 8,
            };
        }

        return {
            ...baseStyle,
            flexDirection: 'row' as const,
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '20px 24px',
        };
    }, [isMobile]);

    const scoreBoxStyle = useMemo(() => {
        const baseStyle = {
            flexShrink: 0, display: 'flex', flexDirection: 'column' as const,
            alignItems: 'center', justifyContent: 'center',
            borderRadius: 10, border: '1px solid var(--accent)', backgroundColor: 'var(--bg)', minWidth: 110,
        };

        if (isMobile) {
            return {
                ...baseStyle,
                width: '100%',
                padding: '8px 16px',
                marginTop: 12,
            };
        }

        return {
            ...baseStyle,
            padding: '12px 20px',
        };
    }, [isMobile]);

    if (isSurvival && survivalResults) {
        return (
            <div style={{ fontFamily: 'var(--font-sans)', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
                <Header lang={lang} onLangChange={setLang} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setUsername(null) }} />
                <div style={{ padding: '32px 20px' }}>
                    <SurvivalResultsPanel
                        score={survivalResults.score}
                        chain={survivalResults.chain}
                        durationSec={survivalResults.durationSec}
                        shareSlot={
                            <SurvivalShareCard
                                chain={survivalResults.chain}
                                chainLength={survivalResults.chainLength}
                                score={survivalResults.score}
                                shareText={survivalResults.shareText}
                                altText={survivalTranslations[lang].results.trailAria(
                                    survivalResults.chainLength,
                                    survivalResults.chain.filter(e => e.outcome === 'completed').length,
                                    survivalResults.chain.filter(e => e.outcome === 'gave_up').length,
                                    survivalResults.score,
                                )}
                                label={survivalTranslations[lang].results.shareCta}
                            />
                        }
                        onPlayAgain={() => {
                            window.location.href = `/game?mode=survival&lang=${survivalState?.language ?? lang}`
                        }}
                        t={survivalTranslations[lang].results}
                    />
                </div>
            </div>
        )
    }

    if (loading || !gameState) {
        return (
            <div style={{ fontFamily: 'var(--font-sans)', minHeight: '100vh', backgroundColor: 'var(--wf-bg)' }}>
                {isMobile ? (
                    <header
                        style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 80,
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--wf-border)',
                            background: 'var(--wf-bg)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                        }}
                    >
                        <Menu size={24} aria-hidden="true" style={{ color: 'var(--wf-ink)' }} />
                        <span
                            style={{
                                fontFamily: 'var(--wf-font-head)',
                                fontSize: 18,
                                fontWeight: 600,
                                letterSpacing: '-0.02em',
                            }}
                        >
                            <span style={{ color: 'var(--wf-ink)' }}>Wiki</span>
                            <span style={{ color: 'var(--wf-accent-text-on-light)' }}>finder</span>
                        </span>
                    </header>
                ) : (
                    <NewDesignHeader lang={lang} onLangChange={setLang} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setUsername(null) }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', gap: 16 }}>
                    {loadError ? (
                        <>
                            <div style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>{loadError}</div>
                            <button onClick={() => loadGame(lang)} style={{
                                padding: '10px 24px', borderRadius: 8, border: '1px solid var(--accent)',
                                backgroundColor: 'var(--surface)', color: 'var(--accent)', fontSize: 14,
                                fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            }}>
                                {lang === 'fr' ? 'Réessayer' : 'Retry'}
                            </button>
                        </>
                    ) : (
                        <div style={{ width: '100%', maxWidth: 700, padding: '0 20px' }}>
                            <div className="skeleton" style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 20 }} />
                            <div className="skeleton" style={{ width: '60%', height: 16, marginBottom: 12 }} />
                            <div className="skeleton" style={{ width: '100%', height: 44, borderRadius: 8, marginBottom: 20 }} />
                            <div className="skeleton" style={{ width: '100%', height: 6, borderRadius: 3, marginBottom: 24 }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div className="skeleton" style={{ width: '90%', height: 18 }} />
                                <div className="skeleton" style={{ width: '75%', height: 18 }} />
                                <div className="skeleton" style={{ width: '85%', height: 18 }} />
                                <div className="skeleton" style={{ width: '70%', height: 18 }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const { tokens, titleWords, guesses, guessCount, won, pageData } = gameState
    const wikipediaUrl = lang === 'fr' ? pageData?.wikipedia_url_fr : pageData?.wikipedia_url_en
    const score = calculateScore(guessCount, won)

    function handleShare() {
        // Génère une grille sans spoiler : 🟩 = mot du titre, nombre de lettres masqué
        const titleHint = gameState!.titleWords
            .map(tw => tw.isStopword ? tw.value : '🟩')
            .join(' ')

        const wordTokens = gameState!.tokens.filter(t => t.type === 'word' && !t.isStopword)
        const revealedCount = wordTokens.filter(t => t.visible).length
        const pct = wordTokens.length > 0 ? Math.round((revealedCount / wordTokens.length) * 100) : 0

        const text = [
            `Wikifinder — ${pageData?.date || ''}`,
            `${guessCount} ${lang === 'fr' ? 'tentatives' : 'guesses'} | Score: ${score.toLocaleString()}`,
            `${pct}% ${lang === 'fr' ? 'de l\'article révélé' : 'of article revealed'}`,
            '',
            'https://wikifinder.vercel.app/game',
        ].join('\n')
        navigator.clipboard.writeText(text).then(() => {
            setShareCopied(true)
            safeSetTimeout(() => setShareCopied(false), 2000)
        })
    }

    function handleChallenge() {
        const date = pageData?.date || new Date().toISOString().split('T')[0]
        const challengeUrl = `https://wikifinder.vercel.app/game?date=${date}&lang=${lang}`
        const text = lang === 'fr'
            ? `Je te défie sur Wikifinder ! Arriveras-tu à battre mon score de ${score.toLocaleString()} pts ?\n\n${challengeUrl}`
            : `I challenge you on Wikifinder! Can you beat my score of ${score.toLocaleString()} pts?\n\n${challengeUrl}`
        navigator.clipboard.writeText(text).then(() => {
            setChallengeCopied(true)
            safeSetTimeout(() => setChallengeCopied(false), 2000)
        })
    }

    // Daily-only onboarding mount (D-20): suppressed in survival runs.
    // Component self-gates via localStorage (wf_onboarded_v1); auth-agnostic (D-21).
    const dailyShareText = lang === 'fr'
        ? `Wikifinder — ${pageData?.date || ''}\n${guessCount} tentatives | Score ${score.toLocaleString()}\nhttps://wikifinder.vercel.app/game`
        : `Wikifinder — ${pageData?.date || ''}\n${guessCount} guesses | Score ${score.toLocaleString()}\nhttps://wikifinder.vercel.app/game`
    const dailyShareAlt = lang === 'fr'
        ? `Wikifinder du ${pageData?.date || ''} — ${guessCount} tentatives, score ${score}`
        : `Wikifinder for ${pageData?.date || ''} — ${guessCount} guesses, score ${score}`
    const dailyMaskedTitleWords = titleWords.map(tw => ({
        revealed: tw.revealed || won,
        text: tw.value,
        width: tw.isStopword ? Math.max(20, (tw.length || 3) * 13) : Math.max(40, (tw.length || 4) * 18),
    }))

    // Phase 9 flag-branch (D-01/D-02). When WF_NEW_DESIGN is ON and a daily game is loaded,
    // render the NewGameScreen tree. Scope: daily game screen only — survival + duel paths
    // stay on the legacy tree this phase (Phase 10+ rework). Flag OFF ⇒ branch skipped ⇒
    // legacy tree below renders byte-identically.
    if (!isSurvival && !duelId) {
        // Fetch /api/game/guess and apply revealedTokens/revealedTitleIndices to
        // gameState. Mirrors the legacy submit handler (lines 716-791) — without
        // this the body words never unmask in the flag-on path because the server
        // masks non-stopword token values to "" and only the response carries the
        // real text. Keeps the sacred <50ms optimistic reveal intact: the caller
        // updates `guesses` and fires `reveal.trigger` BEFORE awaiting this POST.
        const syncGuessWithServer = async (raw: string, found: boolean) => {
            if (!gameState) return
            const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : undefined
            try {
                const res = await fetch('/api/game/guess', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        gameId: gameState.gameId,
                        pageId: gameState.pageData.id,
                        lang,
                        word: raw,
                        // Required for anonymous win-detection: server's
                        // api/game/guess branch for unauthenticated users
                        // (route.ts:197-201) relies on clientPreviousGuesses
                        // to compute `won` against multi-word titles. Authed
                        // users have this reconstructed from DB, so sending
                        // the array is harmless for them. Restores parity
                        // with the legacy guess path at page.tsx:724.
                        previousGuesses: gameState.guesses.map(g => g.word),
                        ...(idempotencyKey ? { idempotencyKey } : {}),
                    }),
                })
                const data = await res.json()

                // Rollback: client said "in article" but server disagrees (Wiktionary miss)
                if (data.wordNotFound) {
                    setGameState(prev => prev ? {
                        ...prev,
                        guesses: prev.guesses.filter(g => g.word !== raw),
                        guessCount: prev.won ? prev.guessCount : Math.max(0, prev.guessCount - 1),
                    } : prev)
                    return
                }
                if (found && !data.isInText && (!data.revealedTokens || data.revealedTokens.length === 0)) {
                    setGameState(prev => prev ? {
                        ...prev,
                        guesses: prev.guesses.map(g => g.word === raw ? { ...g, found: false } : g),
                    } : prev)
                    return
                }

                // Apply revealed tokens + title indices to gameState
                const revealedTokenMap = new Map<number, string>()
                for (const rt of (data.revealedTokens || [])) revealedTokenMap.set(rt.index, rt.value)
                const revealedTitleMap = new Map<number, string>()
                for (const rt of (data.revealedTitleIndices || [])) revealedTitleMap.set(rt.index, rt.value)

                if (revealedTokenMap.size === 0 && revealedTitleMap.size === 0) return

                setGameState(prev => {
                    if (!prev) return prev
                    return {
                        ...prev,
                        tokens: prev.tokens.map(token =>
                            revealedTokenMap.has(token.index)
                                // Keep `visible: false` so ArticleBody routes through
                                // Mask (which carries `data-word` for click-to-cycle),
                                // not the pre-revealed plain <span> branch. Mask
                                // switches to revealed state via foundSet.has(norm).
                                ? { ...token, value: revealedTokenMap.get(token.index)! }
                                : token,
                        ),
                        titleWords: prev.titleWords.map(tw =>
                            revealedTitleMap.has(tw.index)
                                ? { ...tw, value: revealedTitleMap.get(tw.index)!, revealed: true }
                                : tw,
                        ),
                        won: data.won || prev.won,
                    }
                })

                // Phase 10.3 D-01: post-win side-effects, transplanted from the
                // legacy block at page.tsx:794-821. Single-fire guarded by
                // prevWonRef so remount / idempotency replay / tab re-focus
                // cannot double-fire. Confetti recipe + badge stagger + streak
                // refetch are byte-for-byte parity with legacy. ALL off the
                // sacred <50ms optimistic-reveal path (optimistic reveal already
                // ran via handleNewReveal/handleNewMiss before syncGuessWithServer).
                if (data.won && !prevWonRef.current) {
                    prevWonRef.current = true
                    setFrozenElapsed(elapsed)
                    fetch('/api/game/streak')
                        .then(r => r.json())
                        .then(d => setStreak(d.streak || 0))
                        .catch(() => { /* silent per CLAUDE.md */ })
                    void import('canvas-confetti').then(({ default: confetti }) => {
                        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } })
                        safeSetTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.3 } }), 300)
                        safeSetTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.7 } }), 600)
                    })
                    if (data.newBadges && data.newBadges.length > 0) {
                        data.newBadges.forEach((badge: { key: string; name: string; icon: string; rarity: string }, idx: number) => {
                            safeSetTimeout(() => {
                                setBadgeNotifications(prev => [...prev, badge])
                                safeSetTimeout(() => {
                                    setBadgeNotifications(prev => prev.filter(b => b.key !== badge.key))
                                }, 3200)
                            }, idx * 800)
                        })
                    }
                    if (data.seasonUpdate) setSeasonUpdate(data.seasonUpdate)
                }
            } catch {
                /* silent per CLAUDE.md — Sentry catches */
            }
        }

        const handleNewReveal = (normalizedWord: string, rawWord: string) => {
            setGameState(prev => {
                if (!prev) return prev
                if (prev.guesses.some(g => normalize(g.word) === normalizedWord)) return prev
                return {
                    ...prev,
                    guesses: [{ word: rawWord, found: true }, ...prev.guesses],
                    guessCount: prev.won ? prev.guessCount : prev.guessCount + 1,
                }
            })
            void syncGuessWithServer(rawWord, true)
        }
        const handleNewMiss = (raw: string) => {
            setGameState(prev => {
                if (!prev) return prev
                const n = normalize(raw)
                if (prev.guesses.some(g => normalize(g.word) === n)) return prev
                return {
                    ...prev,
                    guesses: [{ word: raw, found: false }, ...prev.guesses],
                    guessCount: prev.won ? prev.guessCount : prev.guessCount + 1,
                }
            })
            void syncGuessWithServer(raw, false)
        }
        // Phase 13 / Plan 04 (D-12, MOD-03) — defeat "Voir la solution" CTA
        // handler. Reveals the full article + title client-side, freezes the
        // timer, and flips revealAll which trips Phase 12 Plan 05's dormant
        // defeat-trigger inside NewGameScreen[Mobile] (revealAll && !won →
        // ResultModal opens automatically).
        const handleRevealSolution = async () => {
            if (!gameState) return
            // Freeze the chrono — this is end-of-game, same as winning.
            setFrozenElapsed(elapsed)

            // Fetch the full body + title token values via /api/game/reveal,
            // reusing allWordsCache when available.
            let bodyMap = allWordsCache
            let titleMap: Map<number, string> | null = null
            try {
                const res = await fetch('/api/game/reveal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pageId: gameState.pageData.id, lang }),
                })
                if (res.ok) {
                    const data = await res.json()
                    if (!bodyMap) {
                        bodyMap = new Map<number, string>()
                        for (const t of data.revealedAll) bodyMap.set(t.index, t.value)
                        setAllWordsCache(bodyMap)
                    }
                    titleMap = new Map<number, string>()
                    for (const tw of (data.revealedTitleAll || [])) titleMap.set(tw.index, tw.value)
                }
            } catch {}

            // Apply both maps to gameState in one setState so the article
            // body, the TitleHero and the ResultModal all read the revealed
            // shape on the same render.
            setGameState(prev => {
                if (!prev) return prev
                const nextTokens = bodyMap
                    ? prev.tokens.map(token =>
                        bodyMap!.has(token.index)
                            ? { ...token, value: bodyMap!.get(token.index)!, visible: true }
                            : token,
                    )
                    : prev.tokens
                const nextTitleWords = titleMap
                    ? prev.titleWords.map(tw =>
                        titleMap!.has(tw.index)
                            ? { ...tw, value: titleMap!.get(tw.index)!, revealed: true }
                            : { ...tw, revealed: true },
                    )
                    : prev.titleWords.map(tw => ({ ...tw, revealed: true }))
                return { ...prev, tokens: nextTokens, titleWords: nextTitleWords }
            })

            // Open the defeat ResultModal via the existing dormant trigger.
            setRevealAll(true)
        }

        // Phase 13 / Plan 04 (D-12) — defeat predicate. Visible only when
        // (a) the user has not won, (b) revealAll hasn't already been
        // flipped (avoid showing CTA after the user already opened the
        // defeat modal once), (c) the user has actually played at least
        // one guess (prevents accidental "give up before starting").
        // No MAX_ATTEMPTS gate exists in this game (unlimited guesses);
        // the CTA is therefore an always-available "give up" rather than
        // a forced end-of-game button.
        const showRevealCTA = !!gameState && !gameState.won && !revealAll && gameState.guesses.length > 0

        // Phase 10.3-06 — Duel creation handler shared by desktop + mobile.
        // Byte-identical to the 10.3-03 inline onDuelCreate (see page.tsx legacy
        // ChallengeButton.onCreate at the equivalent legacy block). Uses the
        // page-level duelToast state already declared in P1.
        const handleDuelCreate = async () => {
            if (!username) {
                setDuelToast({
                    variant: 'error',
                    message: lang === 'fr'
                        ? 'Connectez-vous pour défier un ami'
                        : 'Sign in to challenge a friend',
                })
                return
            }
            try {
                const res = await fetch('/api/duel/create', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ lang, idempotencyKey: crypto.randomUUID() }),
                })
                const body = await res.json()
                if (res.ok && body?.duelUrl) {
                    const url = `${window.location.origin}${body.duelUrl}`
                    const nav = navigator as Navigator & { share?: (d: { url?: string }) => Promise<void> }
                    try {
                        if (typeof nav.share === 'function') await nav.share({ url })
                        else if (navigator.clipboard) await navigator.clipboard.writeText(url)
                    } catch { /* user cancelled */ }
                    setDuelToast({
                        variant: 'success',
                        message: lang === 'fr' ? 'Lien de duel copié' : 'Duel link copied',
                    })
                } else {
                    setDuelToast({
                        variant: 'error',
                        message: lang === 'fr' ? 'Impossible de créer le duel' : 'Could not create duel',
                    })
                }
            } catch {
                setDuelToast({
                    variant: 'error',
                    message: lang === 'fr' ? 'Erreur réseau' : 'Network error',
                })
            }
        }

        // Phase 10 (D-01/D-16): JS-branched mobile routing inside the existing
        // flag-branch. Mobile-viewport users get NewGameScreenMobile (MobileShell
        // provides its own top bar — NewDesignHeader is suppressed per D-16 and
        // the legacy-token bridge div is unnecessary since the mobile tree uses
        // var(--wf-*) tokens natively). Desktop fall-through unchanged.
        if (isMobile) {
            return (
                <>
                    <NewGameScreenMobile
                        gameState={gameState}
                        input={input}
                        setInput={setInput}
                        elapsed={frozenElapsed ?? elapsed}
                        lang={lang}
                        onLangChange={setLang}
                        onMiss={handleNewMiss}
                        onRevealHandled={handleNewReveal}
                        onDuelCreate={handleDuelCreate}
                        username={username}
                        favoriteBadge={favoriteBadge}
                        onOpenOnboarding={() => setOnboardingOpen(true)}
                        onOpenFeedback={() => setFeedbackOpen(true)}
                        revealAll={revealAll}
                        onRevealSolution={showRevealCTA ? handleRevealSolution : undefined}
                    />
                    {/* Phase 10.3 D-09 P3 plumbing: DuelToast feedback surface
                        so ChallengeButton's onCreate (wired in P3) has a toast
                        to render. Uses existing page-level duelToast state. */}
                    {duelToast && (
                        <DuelToast
                            variant={duelToast.variant}
                            message={duelToast.message}
                            onDismiss={() => setDuelToast(null)}
                        />
                    )}
                    {/* Phase 12 / Plan 05 — new-design modals mounted as
                        page-level siblings (Pattern S7). Strict swap (D-18):
                        these only appear in the newDesignOn branch; legacy
                        OnboardingOverlay still mounts in !newDesignOn. */}
                    <OnboardingModal
                        open={onboardingOpen}
                        onClose={() => setOnboardingOpen(false)}
                        lang={lang}
                    />
                    <FeedbackModal
                        open={feedbackOpen}
                        onClose={() => setFeedbackOpen(false)}
                        lang={lang}
                        gameState={gameState}
                    />
                    {/* Phase 13 / Plan 03 — POL-02 visually-hidden ARIA live region
                        (D-05). Single page-level region fed by both body-token and
                        title-letter reveal sites. */}
                    <div
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        style={{
                            position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
                            overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
                        }}
                    >
                        {revealAnnouncement}
                    </div>
                </>
            )
        }
        return (
            <div style={{
                fontFamily: 'var(--wf-font-ui)',
                minHeight: '100vh',
                background: 'var(--wf-bg)',
                // Override legacy --bg/--surface/--border tokens inside the
                // new-design tree so the legacy <Header> adopts the minimal-amber
                // palette and blends with the new body (fixes slate-vs-black seam).
                // Legacy Header source is unmodified — D-02 preserved.
                ['--bg' as string]: 'var(--wf-bg)',
                ['--surface' as string]: 'var(--wf-bg2)',
                ['--border' as string]: 'var(--wf-border)',
                ['--text' as string]: 'var(--wf-ink)',
                ['--text-muted' as string]: 'var(--wf-muted)',
                ['--accent' as string]: 'var(--wf-accent)',
            }}>
                <NewDesignHeader lang={lang} onLangChange={setLang} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setUsername(null) }} />
                <NewGameScreen
                    gameState={gameState}
                    input={input}
                    setInput={setInput}
                    elapsed={frozenElapsed ?? elapsed}
                    lang={lang}
                    onMiss={handleNewMiss}
                    onRevealHandled={handleNewReveal}
                    // Phase 10.3 P4 — thread streak into NewGameScreen so
                    // ResultModal can display it (via DailyShareCard). Page-
                    // level `streak` state is populated by the P1 win-trigger
                    // in syncGuessWithServer (null until fetched).
                    streak={streak}
                    onDuelCreate={handleDuelCreate}
                    username={username}
                    favoriteBadge={favoriteBadge}
                    onOpenOnboarding={() => setOnboardingOpen(true)}
                    onOpenFeedback={() => setFeedbackOpen(true)}
                    revealAll={revealAll}
                    onRevealSolution={showRevealCTA ? handleRevealSolution : undefined}
                />
                {/* Phase 10.3 D-09 P3 plumbing: DuelToast feedback surface for
                    ChallengeButton.onCreate (wired in P3). Sibling of the screen
                    so it overlays irrespective of NewGameScreen's internal layout. */}
                {duelToast && (
                    <DuelToast
                        variant={duelToast.variant}
                        message={duelToast.message}
                        onDismiss={() => setDuelToast(null)}
                    />
                )}
                {/* Phase 12 / Plan 05 — new-design modals mounted as
                    page-level siblings (Pattern S7). D-18 strict swap:
                    only in the newDesignOn branch. */}
                <OnboardingModal
                    open={onboardingOpen}
                    onClose={() => setOnboardingOpen(false)}
                    lang={lang}
                />
                <FeedbackModal
                    open={feedbackOpen}
                    onClose={() => setFeedbackOpen(false)}
                    lang={lang}
                    gameState={gameState}
                />
                {/* Phase 13 / Plan 03 — POL-02 visually-hidden ARIA live region
                    (D-05). Single page-level region fed by both body-token and
                    title-letter reveal sites. */}
                <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    style={{
                        position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
                        overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
                    }}
                >
                    {revealAnnouncement}
                </div>
            </div>
        )
    }

    return (
        <div style={{ fontFamily: 'var(--font-sans)', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
            {!isSurvival && <OnboardingOverlay lang={lang} />}
            {/* Badge unlock notifications */}
            {badgeNotifications.length > 0 && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    padding: '12px 16px', pointerEvents: 'none',
                }}>
                    {badgeNotifications.map(badge => {
                        const rarityColors: Record<string, string> = { bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700' }
                        const borderColor = rarityColors[badge.rarity] || 'var(--border)'
                        return (
                            <div key={badge.key} className="badge-notification" style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 20px', borderRadius: 12,
                                backgroundColor: 'var(--surface)',
                                border: `2px solid ${borderColor}`,
                                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                pointerEvents: 'auto',
                            }}>
                                <span style={{ fontSize: 28 }}>{badge.icon}</span>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                                        {lang === 'fr' ? 'Badge debloque !' : 'Badge unlocked!'}
                                    </div>
                                    <div style={{ fontSize: 13, color: borderColor, fontWeight: 600 }}>
                                        {badge.name}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
            <Header lang={lang} onLangChange={setLang} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setUsername(null) }} />
            {user && !isSurvival && !duelId && (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
                    <ChallengeButton
                        lang={lang as 'fr' | 'en'}
                        onCreate={async () => {
                            try {
                                const res = await fetch('/api/duel/create', {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json' },
                                    body: JSON.stringify({ lang, idempotencyKey: crypto.randomUUID() }),
                                })
                                const body = await res.json()
                                if (res.ok && body?.duelUrl) {
                                    const url = `${window.location.origin}${body.duelUrl}`
                                    const nav = navigator as Navigator & { share?: (d: { url?: string }) => Promise<void> }
                                    try {
                                        if (typeof nav.share === 'function') await nav.share({ url })
                                        else if (navigator.clipboard) await navigator.clipboard.writeText(url)
                                    } catch { /* user cancelled */ }
                                    setDuelToast({
                                        variant: 'success',
                                        message: lang === 'fr' ? 'Lien de duel copié' : 'Duel link copied',
                                    })
                                } else {
                                    setDuelToast({
                                        variant: 'error',
                                        message: lang === 'fr' ? 'Impossible de créer le duel' : 'Could not create duel',
                                    })
                                }
                            } catch {
                                setDuelToast({
                                    variant: 'error',
                                    message: lang === 'fr' ? 'Erreur réseau' : 'Network error',
                                })
                            }
                        }}
                    />
                </div>
            )}
            {duelToast && (
                <DuelToast
                    variant={duelToast.variant}
                    message={duelToast.message}
                    onDismiss={() => setDuelToast(null)}
                />
            )}

            <div style={{
                maxWidth: 1200,
                margin: '0 auto',
                padding: '0 20px',
                display: 'flex',
                gap: 32,
                flexDirection: isMobile ? 'column' : 'row'
            }}>

                {/* Colonne gauche — historique desktop */}
                {!isMobile && (
                    <div className="history-scroll" style={{
                        width: 180, flexShrink: 0, position: 'sticky', top: 20,
                        alignSelf: 'flex-start', maxHeight: 'calc(100vh - 40px)',
                        overflowY: 'auto', paddingTop: 32, paddingRight: 8, paddingBottom: 2,
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
                            {t.history}
                        </div>
                        {guesses.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.noWords}</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {guesses.map((g, i) => (
                                    <div key={i} onClick={() => g.found && scrollToOccurrence(g.word)}
                                        title={g.found ? 'Cliquer pour localiser dans le texte' : ''}
                                        style={{
                                            backgroundColor: g.found ? 'var(--revealed)' : 'var(--surface)',
                                            border: '1px solid ' + (g.found ? 'var(--accent)' : 'var(--border)'),
                                            padding: '6px 12px', borderRadius: 6, fontSize: 14,
                                            color: g.found ? 'var(--accent)' : 'var(--text-muted)',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                            fontWeight: g.found ? 600 : 400,
                                            cursor: g.found ? 'pointer' : 'default', transition: 'opacity 0.15s',
                                        }}>
                                        {g.word}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>

                    {isSurvival && survivalState && !survivalResults && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: '8px 16px',
                            borderBottom: '1px solid var(--border)',
                            marginBottom: 16,
                            minHeight: 44,
                        }}>
                            <SurvivalLivesIndicator
                                livesRemaining={survivalState.livesRemaining as 0 | 1 | 2 | 3}
                                t={survivalTranslations[lang]}
                            />
                            <SurvivalChainBadge
                                length={survivalState.chainLength}
                                t={survivalTranslations[lang]}
                            />
                            <div style={{ flex: 1 }} />
                            <GiveUpButton
                                livesRemaining={survivalState.livesRemaining}
                                onConfirm={handleSurvivalGiveUp}
                                disabled={!survivalState.gameId}
                                t={survivalTranslations[lang].giveUp}
                            />
                        </div>
                    )}

                    {won && duelId && isDuelGame && (
                        <div style={{
                            marginTop: 24, marginBottom: 16, padding: 16, borderRadius: 8,
                            backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        }}>
                            <div style={{ color: 'var(--text)', fontWeight: 500, fontSize: 14 }}>
                                {lang === 'fr' ? 'Duel terminé — compare vos résultats.' : 'Duel finished — compare results.'}
                            </div>
                            <a href={`/duel/${duelId}`} style={{
                                padding: '8px 16px', borderRadius: 6, backgroundColor: 'var(--accent)',
                                color: 'var(--surface)', textDecoration: 'none', fontWeight: 600, fontSize: 13,
                                whiteSpace: 'nowrap',
                            }}>
                                {lang === 'fr' ? 'Voir le résultat du duel' : 'See duel result'}
                            </a>
                        </div>
                    )}

                    <TitleDisplay
                        titleWords={titleWords}
                        won={won}
                        guessCount={guessCount}
                        score={score}
                        streak={streak}
                        lang={lang}
                        revealAll={revealAll}
                        setRevealAll={async (fn) => {
                            const newVal = fn(revealAll)
                            if (newVal && gameState) {
                                // Révéler : fetch les valeurs si pas encore en cache
                                let wordsMap = allWordsCache
                                if (!wordsMap) {
                                    try {
                                        const res = await fetch('/api/game/reveal', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ pageId: gameState.pageData.id, lang }),
                                        })
                                        if (res.ok) {
                                            const data = await res.json()
                                            wordsMap = new Map<number, string>()
                                            for (const t of data.revealedAll) wordsMap.set(t.index, t.value)
                                            setAllWordsCache(wordsMap)
                                        }
                                    } catch {}
                                }
                                if (wordsMap) {
                                    setGameState(prev => prev ? {
                                        ...prev,
                                        tokens: prev.tokens.map(token =>
                                            wordsMap!.has(token.index)
                                                ? { ...token, value: wordsMap!.get(token.index)!, visible: true }
                                                : token
                                        ),
                                    } : prev)
                                }
                            } else if (!newVal && gameState && allWordsCache) {
                                // Masquer : remet les mots non devinés en masqué
                                // On garde les mots qui étaient déjà trouvés par le joueur
                                setGameState(prev => {
                                    if (!prev) return prev
                                    // Les mots trouvés sont ceux dans l'historique des guesses
                                    return {
                                        ...prev,
                                        tokens: prev.tokens.map(token => {
                                            if (token.type !== 'word' || token.isStopword) return token
                                            // Si le mot a été deviné par le joueur, le garder visible
                                            const wasGuessed = prev.guesses.some(g =>
                                                g.found && wordsMatch(g.word, token.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, ''))
                                            )
                                            if (wasGuessed) return token
                                            // Sinon, re-masquer
                                            return { ...token, value: '', visible: false }
                                        }),
                                    }
                                })
                            }
                            setRevealAll(newVal)
                        }}
                        wikipediaUrl={wikipediaUrl}
                        shareCopied={shareCopied}
                        onShare={handleShare}
                        challengeCopied={challengeCopied}
                        onChallenge={handleChallenge}
                        hideChallenge={!!duelId}
                        hintTokenIndex={hintTokenIndex}
                        justRevealedTitle={justRevealedTitle}
                        showHint={showHint}
                        isMobile={isMobile}
                        titleScoreStyle={titleScoreStyle}
                        scoreBoxStyle={scoreBoxStyle}
                        seasonUpdate={seasonUpdate}
                        shareSlot={won && !isSurvival ? (
                            <DailyShareCard
                                streak={user ? streak : null}
                                score={score}
                                maskedTitleWords={dailyMaskedTitleWords}
                                articleDate={pageData?.date || new Date().toISOString().slice(0, 10)}
                                lang={lang}
                                shareText={dailyShareText}
                                altText={dailyShareAlt}
                                label={shareCopied ? t.copied : t.share}
                            />
                        ) : undefined}
                        t={t}
                    />

                    <GuessInput
                        inputRef={inputRef}
                        input={input}
                        setInput={setInput}
                        inputError={inputError}
                        setInputError={setInputError}
                        handleKeyDown={handleKeyDown}
                        handleGuess={handleGuess}
                        submitting={submitting}
                        tokens={tokens}
                        guesses={guesses}
                        guessCount={guessCount}
                        isMobile={isMobile}
                        scrollToOccurrence={scrollToOccurrence}
                        elapsed={frozenElapsed ?? elapsed}
                        won={won}
                        t={t}
                    />

                    <div style={{ fontSize: 15, color: 'var(--text)', paddingTop: inputError ? 20 : 0 }}>
                        <TokenRenderer
                            tokens={tokens}
                            revealAll={revealAll}
                            hintTokenIndex={hintTokenIndex}
                            justRevealedTokens={justRevealedTokens}
                            proximityHints={proximityHints}
                            pendingRevealLength={pendingRevealLength}
                            showHint={showHint}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40, marginBottom: 20 }}>
                        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ padding: '8px 20px', borderRadius: 20, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                            {isMobile ? t.backToTopMobile : t.backToTop}
                        </button>
                    </div>

                    {!isSurvival && (
                        <PushOptInSheet
                            lang={lang}
                            authed={!!user}
                            completedTodayCount={won ? 1 : 0}
                        />
                    )}

                </div>
            </div>
        </div>
    )
}
