'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { isStopword } from '@/lib/wikipedia'
import { normalize, wordsMatch } from '@/lib/matching'
import { setWordHashSet, isWordInArticle } from '@/lib/client-hash'
import { useIsMobile, calculateScore } from '@/lib/utils'
import confetti from 'canvas-confetti'
import Header from '@/components/Header'
import Loader from '@/components/Loader'
import TokenRenderer from '@/components/game/TokenRenderer'
import GuessInput from '@/components/game/GuessInput'
import TitleDisplay from '@/components/game/TitleDisplay'
import { GameState, translations } from '@/app/game/types'

const RANK_COLORS: Record<string, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#40E0D0',
    diamond: '#B9F2FF',
}

const RANK_NAMES_FR: Record<string, string> = {
    bronze: 'Bronze',
    silver: 'Argent',
    gold: 'Or',
    platinum: 'Platine',
    diamond: 'Diamant',
}

const RANK_NAMES_EN: Record<string, string> = {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    diamond: 'Diamond',
}

const DIFFICULTY_LABELS_FR: Record<string, string> = {
    bronze: 'Facile',
    silver: 'Moyen',
    gold: 'Difficile',
    platinum: 'Tres difficile',
    diamond: 'Expert',
}

const DIFFICULTY_LABELS_EN: Record<string, string> = {
    bronze: 'Easy',
    silver: 'Medium',
    gold: 'Hard',
    platinum: 'Very Hard',
    diamond: 'Expert',
}

type Phase = 'select' | 'loading' | 'playing'

export default function RankedPage() {
    const [phase, setPhase] = useState<Phase>('select')
    const [gameState, setGameState] = useState<GameState | null>(null)
    const [revealAll, setRevealAll] = useState(false)
    const [allWordsCache, setAllWordsCache] = useState<Map<number, string> | null>(null)
    const [frozenElapsed, setFrozenElapsed] = useState<number | null>(null)
    const [lang, setLang] = useState<'fr' | 'en'>('fr')
    const [loadError, setLoadError] = useState<string | null>(null)
    const [input, setInput] = useState('')
    const [inputError, setInputError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [startedAt, setStartedAt] = useState<Date | null>(null)
    const [elapsed, setElapsed] = useState(0)
    const [user, setUser] = useState<any>(null)
    const [username, setUsername] = useState<string | null>(null)
    const [clickedWord, setClickedWord] = useState<{ word: string, index: number } | null>(null)
    const [inputHistory, setInputHistory] = useState<string[]>([])
    const [inputHistoryIndex, setInputHistoryIndex] = useState<number>(-1)
    const [hintTokenIndex, setHintTokenIndex] = useState<number | null>(null)
    const [shareCopied, setShareCopied] = useState(false)
    const [justRevealedTokens, setJustRevealedTokens] = useState<Set<number>>(new Set())
    const [justRevealedTitle, setJustRevealedTitle] = useState<Set<number>>(new Set())
    const [proximityHints, setProximityHints] = useState<Map<number, { score: number; word: string }>>(new Map())
    const [badgeNotifications, setBadgeNotifications] = useState<{ key: string; name: string; icon: string; rarity: string }[]>([])
    const [seasonUpdate, setSeasonUpdate] = useState<{ seasonName: string; totalScore: number; rank: string; rankedScore: number } | null>(null)
    const [difficulty, setDifficulty] = useState<string>('bronze')
    const [wikipediaUrl, setWikipediaUrl] = useState<string | null>(null)

    // Season info for pre-game screen
    const [currentRank, setCurrentRank] = useState<string>('bronze')
    const [currentScore, setCurrentScore] = useState<number>(0)
    const [seasonLoading, setSeasonLoading] = useState(true)

    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const supabase = createSupabaseBrowserClient()
    const isMobile = useIsMobile()
    const t = translations[lang]

    // Timer
    useEffect(() => {
        if (!startedAt || gameState?.won) return
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
        }, 1000)
        return () => clearInterval(interval)
    }, [startedAt, gameState?.won])

    // Auth + season info
    useEffect(() => {
        supabase.auth.getUser().then(async ({ data }) => {
            setUser(data.user)
            if (data.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', data.user.id)
                    .single()
                if (profile) setUsername(profile.username)
            }
        })

        // Fetch season info for rank display
        fetch('/api/season')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && data.season) {
                    // Find current user's rank from leaderboard
                    supabase.auth.getUser().then(({ data: authData }) => {
                        if (authData.user && data.leaderboard) {
                            const entry = data.leaderboard.find((e: any) => e.username === username)
                            if (entry) {
                                setCurrentRank(entry.rank || 'bronze')
                                setCurrentScore(entry.total_score || 0)
                            }
                        }
                        setSeasonLoading(false)
                    })
                } else {
                    setSeasonLoading(false)
                }
            })
            .catch(() => setSeasonLoading(false))
    }, [])

    async function startRankedGame(selectedLang: 'fr' | 'en') {
        setLang(selectedLang)
        setPhase('loading')
        setLoadError(null)

        try {
            const res = await fetch('/api/ranked/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lang: selectedLang }),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                // Ne jamais afficher d'erreur technique à l'utilisateur
                const safeMessages = [
                    'Aucun article disponible',
                    'No article available',
                    'Connexion requise',
                    'Login required',
                ]
                const isSafe = safeMessages.some(m => err.error?.includes(m))
                setLoadError(isSafe
                    ? err.error
                    : (selectedLang === 'fr' ? 'Erreur lors du chargement. Réessaie plus tard.' : 'Failed to load game. Try again later.'))
                setPhase('select')
                return
            }

            const data = await res.json()

            setDifficulty(data.difficulty)
            setWikipediaUrl(data.wikipedia_url)

            if (data.wordHashSet) {
                setWordHashSet(data.wordHashSet)
            }

            setGameState({
                tokens: data.tokens,
                titleWords: data.titleWords,
                guesses: [],
                guessCount: 0,
                won: false,
                pageData: { id: data.pageId, wikipedia_url_fr: data.wikipedia_url, wikipedia_url_en: data.wikipedia_url },
                gameId: data.gameId,
            })

            setStartedAt(new Date())
            setElapsed(0)
            setPhase('playing')
            setTimeout(() => inputRef.current?.focus(), 100)
        } catch {
            setLoadError(selectedLang === 'fr' ? 'Erreur réseau.' : 'Network error.')
            setPhase('select')
        }
    }

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
            setTimeout(() => el.classList.remove('word-highlight'), 1200)
            return { word: normWord, index: nextIndex }
        })
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') { handleGuess(); return }
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
            setInput(''); setInputError(null); inputRef.current?.focus(); return
        }

        if (gameState.guesses.some(g => wordsMatch(g.word, word))) {
            setInput('')
            setInputError(t.alreadyGuessed)
            inputRef.current?.focus()
            return
        }

        const alreadyWon = gameState.won

        // ========== OPTIMISTIC REVEAL ==========
        const inArticle = await isWordInArticle(word)
        setInput('')
        setInputError(null)

        if (inArticle) {
            setGameState(prev => prev ? {
                ...prev,
                guesses: [{ word, found: true }, ...prev.guesses],
                guessCount: alreadyWon ? prev.guessCount : prev.guessCount + 1,
            } : prev)
        } else {
            setGameState(prev => prev ? {
                ...prev,
                guesses: [{ word, found: false }, ...prev.guesses],
                guessCount: alreadyWon ? prev.guessCount : prev.guessCount + 1,
            } : prev)
        }

        inputRef.current?.focus()

        // Background server sync
        const guessBody = {
            gameId: gameState.gameId,
            pageId: gameState.pageData.id,
            lang,
            word,
            elapsed,
            ...(!gameState.gameId && !alreadyWon && { previousGuesses: gameState.guesses.map(g => g.word) }),
        }

        fetch('/api/game/guess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guessBody),
        }).then(async res => {
            const data = await res.json()

            if (data.wordNotFound) {
                setInputError(t.wordNotFound)
                setGameState(prev => prev ? {
                    ...prev,
                    guesses: prev.guesses.filter(g => g.word !== word),
                    guessCount: alreadyWon ? prev.guessCount : prev.guessCount - 1,
                } : prev)
                return
            }

            if (data.guessCount !== null && data.guessCount !== undefined) {
                setGameState(prev => prev ? {
                    ...prev,
                    guessCount: alreadyWon ? prev.guessCount : data.guessCount,
                } : prev)
            }

            const { revealedTokens, revealedTitleIndices, won: isWon } = data

            // Rollback si faux positif du hash check
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

                setJustRevealedTokens(new Set(revealedTokenMap.keys()))
                setTimeout(() => setJustRevealedTokens(new Set()), 700)
                if (revealedTitleIndices && revealedTitleIndices.length > 0) {
                    setJustRevealedTitle(new Set<number>(revealedTitleIndices.map((rt: { index: number }) => rt.index)))
                    setTimeout(() => setJustRevealedTitle(new Set()), 900)
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
                setFrozenElapsed(elapsed)
                confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } })
                setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.3 } }), 300)
                setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.7 } }), 600)

                if (data.newBadges && data.newBadges.length > 0) {
                    data.newBadges.forEach((badge: { key: string; name: string; icon: string; rarity: string }, idx: number) => {
                        setTimeout(() => {
                            setBadgeNotifications(prev => [...prev, badge])
                            setTimeout(() => {
                                setBadgeNotifications(prev => prev.filter(b => b.key !== badge.key))
                            }, 3200)
                        }, idx * 800)
                    })
                }

                if (data.seasonUpdate) {
                    setSeasonUpdate(data.seasonUpdate)
                }
            }
        }).catch(() => {})

        // Proximity hints
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
        }
        if (isMobile) {
            return { ...baseStyle, flexDirection: 'column' as const, alignItems: 'center', padding: '12px 16px', gap: 8 }
        }
        return { ...baseStyle, flexDirection: 'row' as const, justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px' }
    }, [isMobile])

    const scoreBoxStyle = useMemo(() => {
        const baseStyle = {
            flexShrink: 0, display: 'flex', flexDirection: 'column' as const,
            alignItems: 'center', justifyContent: 'center',
            borderRadius: 10, border: '1px solid var(--accent)', backgroundColor: 'var(--bg)', minWidth: 110,
        }
        if (isMobile) {
            return { ...baseStyle, width: '100%', padding: '8px 16px', marginTop: 12 }
        }
        return { ...baseStyle, padding: '12px 20px' }
    }, [isMobile])

    const rankNames = lang === 'fr' ? RANK_NAMES_FR : RANK_NAMES_EN
    const diffLabels = lang === 'fr' ? DIFFICULTY_LABELS_FR : DIFFICULTY_LABELS_EN

    // ==================== SELECTION SCREEN ====================
    if (phase === 'select') {
        return (
            <div style={{ fontFamily: 'var(--font-sans)', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
                <Header lang={lang} onLangChange={setLang} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setUsername(null) }} />
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minHeight: '70vh', padding: '0 20px',
                }}>
                    <div style={{
                        backgroundColor: 'var(--surface)', borderRadius: 16,
                        border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
                        padding: isMobile ? '28px 20px' : '40px 48px',
                        maxWidth: 480, width: '100%', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                            {lang === 'fr' ? 'Mode classé' : 'Ranked Mode'}
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>
                            {lang === 'fr'
                                ? 'Articles adaptés à ton rang. Gagne des points et monte en classement !'
                                : 'Articles matched to your rank. Earn points and climb the leaderboard!'}
                        </div>

                        {/* Current rank display */}
                        {seasonLoading ? (
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                marginBottom: 28, padding: '16px 20px',
                                backgroundColor: 'var(--bg)', borderRadius: 12,
                                border: '1px solid var(--border)',
                            }}>
                                <div className="skeleton" style={{ width: 80, height: 12 }} />
                                <div className="skeleton" style={{ width: 120, height: 28 }} />
                                <div className="skeleton" style={{ width: 60, height: 13 }} />
                                <div className="skeleton" style={{ width: 100, height: 20, borderRadius: 10 }} />
                            </div>
                        ) : (
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                marginBottom: 28, padding: '16px 20px',
                                backgroundColor: 'var(--bg)', borderRadius: 12,
                                border: '1px solid var(--border)',
                            }}>
                                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                    {lang === 'fr' ? 'Ton rang' : 'Your rank'}
                                </div>
                                <div style={{
                                    fontSize: 28, fontWeight: 700,
                                    color: RANK_COLORS[currentRank] || 'var(--accent)',
                                }}>
                                    {rankNames[currentRank] || 'Bronze'}
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    {currentScore.toLocaleString()} pts
                                </div>
                                <div style={{
                                    marginTop: 8, fontSize: 12, color: 'var(--text-muted)',
                                    backgroundColor: 'var(--surface)', padding: '6px 14px',
                                    borderRadius: 20, border: '1px solid var(--border)',
                                }}>
                                    {lang === 'fr' ? 'Difficulté : ' : 'Difficulty: '}
                                    <span style={{ fontWeight: 600, color: RANK_COLORS[currentRank] || 'var(--accent)' }}>
                                        {diffLabels[currentRank] || 'Easy'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {loadError && (
                            <div style={{
                                marginBottom: 16, padding: '10px 16px', borderRadius: 8,
                                backgroundColor: '#fee2e2', color: '#dc2626', fontSize: 13, fontWeight: 500,
                            }}>
                                {loadError}
                            </div>
                        )}

                        {!user && (
                            <div style={{
                                marginBottom: 20, padding: '10px 16px', borderRadius: 8,
                                backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
                                color: 'var(--text-muted)', fontSize: 13,
                            }}>
                                {lang === 'fr'
                                    ? 'Connecte-toi pour jouer en mode classé.'
                                    : 'Log in to play ranked mode.'}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <button
                                onClick={() => startRankedGame('fr')}
                                disabled={!user}
                                style={{
                                    padding: '14px 24px', fontSize: 16, fontWeight: 600, borderRadius: 10,
                                    border: 'none', backgroundColor: 'var(--accent)', color: 'white',
                                    cursor: user ? 'pointer' : 'not-allowed',
                                    opacity: user ? 1 : 0.5,
                                    fontFamily: 'var(--font-sans)', transition: 'opacity 0.2s',
                                }}
                            >
                                Jouer en Francais
                            </button>
                            <button
                                onClick={() => startRankedGame('en')}
                                disabled={!user}
                                style={{
                                    padding: '14px 24px', fontSize: 16, fontWeight: 600, borderRadius: 10,
                                    border: '1px solid var(--accent)', backgroundColor: 'transparent',
                                    color: 'var(--accent)',
                                    cursor: user ? 'pointer' : 'not-allowed',
                                    opacity: user ? 1 : 0.5,
                                    fontFamily: 'var(--font-sans)', transition: 'opacity 0.2s',
                                }}
                            >
                                Play in English
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ==================== LOADING SCREEN ====================
    if (phase === 'loading' || !gameState) {
        return (
            <div style={{ fontFamily: 'var(--font-sans)', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
                <Header lang={lang} onLangChange={setLang} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setUsername(null) }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', gap: 16 }}>
                    <Loader />
                    <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        {lang === 'fr' ? 'Chargement de la partie classée...' : 'Loading ranked game...'}
                    </div>
                </div>
            </div>
        )
    }

    // ==================== GAME SCREEN ====================
    const { tokens, titleWords, guesses, guessCount, won, pageData } = gameState
    const score = calculateScore(guessCount, won)

    function handleShare() {
        const wordTokens = gameState!.tokens.filter(t => t.type === 'word' && !t.isStopword)
        const revealedCount = wordTokens.filter(t => t.visible).length
        const pct = wordTokens.length > 0 ? Math.round((revealedCount / wordTokens.length) * 100) : 0

        const text = [
            `Wikifinder — Mode classé`,
            `${guessCount} ${lang === 'fr' ? 'tentatives' : 'guesses'} | Score: ${score.toLocaleString()}`,
            `${pct}% ${lang === 'fr' ? "de l'article revele" : 'of article revealed'}`,
            `Difficulté : ${diffLabels[difficulty] || difficulty}`,
            '',
            'https://wikifinder.vercel.app/ranked',
        ].join('\n')
        navigator.clipboard.writeText(text).then(() => {
            setShareCopied(true)
            setTimeout(() => setShareCopied(false), 2000)
        })
    }

    return (
        <div style={{ fontFamily: 'var(--font-sans)', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
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

            {/* Difficulty badge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, marginBottom: -8 }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '6px 16px', borderRadius: 20,
                    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                    fontSize: 13, color: 'var(--text-muted)',
                }}>
                    <span style={{ fontWeight: 700, color: RANK_COLORS[difficulty] || 'var(--accent)' }}>
                        {rankNames[difficulty] || difficulty}
                    </span>
                    <span>-</span>
                    <span>{diffLabels[difficulty] || difficulty}</span>
                </div>
            </div>

            <div style={{
                maxWidth: 1200,
                margin: '0 auto',
                padding: '0 20px',
                display: 'flex',
                gap: 32,
                flexDirection: isMobile ? 'column' : 'row'
            }}>

                {/* Left column - history (desktop) */}
                {!isMobile && (
                    <div className="history-scroll" style={{
                        width: 180, flexShrink: 0, position: 'sticky', top: 20,
                        alignSelf: 'flex-start', maxHeight: 'calc(100vh - 40px)',
                        overflowY: 'auto', paddingTop: 32, paddingRight: 8,
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
                                        title={g.found ? (lang === 'fr' ? 'Cliquer pour localiser dans le texte' : 'Click to locate in text') : ''}
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

                    <TitleDisplay
                        titleWords={titleWords}
                        won={won}
                        guessCount={guessCount}
                        score={score}
                        streak={null}
                        lang={lang}
                        revealAll={revealAll}
                        setRevealAll={async (fn) => {
                            const newVal = fn(revealAll)
                            if (newVal && gameState) {
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
                                setGameState(prev => {
                                    if (!prev) return prev
                                    return {
                                        ...prev,
                                        tokens: prev.tokens.map(token => {
                                            if (token.type !== 'word' || token.isStopword) return token
                                            const wasGuessed = prev.guesses.some(g =>
                                                g.found && wordsMatch(g.word, token.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, ''))
                                            )
                                            if (wasGuessed) return token
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
                        challengeCopied={false}
                        onChallenge={() => {}}
                        hintTokenIndex={hintTokenIndex}
                        justRevealedTitle={justRevealedTitle}
                        showHint={showHint}
                        isMobile={isMobile}
                        titleScoreStyle={titleScoreStyle}
                        scoreBoxStyle={scoreBoxStyle}
                        seasonUpdate={seasonUpdate}
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
                            pendingRevealLength={null}
                            showHint={showHint}
                        />
                    </div>

                    {/* Play again button after victory */}
                    {won && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 32, marginBottom: 12 }}>
                            <button
                                onClick={() => {
                                    setGameState(null)
                                    setRevealAll(false)
                                    setAllWordsCache(null)
                                    setFrozenElapsed(null)
                                    setInput('')
                                    setInputError(null)
                                    setInputHistory([])
                                    setInputHistoryIndex(-1)
                                    setHintTokenIndex(null)
                                    setJustRevealedTokens(new Set())
                                    setJustRevealedTitle(new Set())
                                    setProximityHints(new Map())
                                    setSeasonUpdate(null)
                                    setShareCopied(false)
                                    setPhase('select')
                                }}
                                style={{
                                    padding: '12px 28px', fontSize: 15, fontWeight: 600, borderRadius: 10,
                                    border: 'none', backgroundColor: 'var(--accent)', color: 'white',
                                    cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'opacity 0.2s',
                                }}
                            >
                                {lang === 'fr' ? 'Nouvelle partie classée' : 'New ranked game'}
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20, marginBottom: 20 }}>
                        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ padding: '8px 20px', borderRadius: 20, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                            {isMobile ? t.backToTopMobile : t.backToTop}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    )
}
