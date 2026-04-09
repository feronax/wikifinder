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
import { GameState, translations } from './types'

export default function GamePage() {
    const [gameState, setGameState] = useState<GameState | null>(null)
    const [revealAll, setRevealAll] = useState(false)
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

    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Timer
    useEffect(() => {
        if (!startedAt || gameState?.won) return
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
        }, 1000)
        return () => clearInterval(interval)
    }, [startedAt, gameState?.won])
    const inputRef = useRef<HTMLInputElement>(null)
    const supabase = createSupabaseBrowserClient()
    const isMobile = useIsMobile()
    const t = translations[lang]

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
    }, [])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const dateParam = params.get('date')
        const langParam = params.get('lang') as 'fr' | 'en' | null
        if (langParam && langParam !== lang && (langParam === 'fr' || langParam === 'en')) {
            setLang(langParam)
            return
        }
        loadGame(lang, dateParam || undefined)
    }, [lang])

    async function loadGame(l: 'fr' | 'en', date?: string) {
        setLoading(true)
        setLoadError(null)
        setRevealAll(false)
        setClickedWord(null)
        setHintTokenIndex(null)

        let todayUrl = `/api/game/today?lang=${l}`
        if (date) todayUrl += `&date=${date}`

        // Charge la page sans gameId d'abord pour obtenir le pageId
        const preRes = await fetch(todayUrl)
        if (!preRes.ok) {
            setLoadError(l === 'fr' ? 'Impossible de charger la partie du jour.' : 'Could not load today\'s game.')
            setLoading(false)
            return
        }
        const preData = await preRes.json()
        const pageId = preData.id

        // Start/restore la partie
        const startRes2 = await fetch('/api/game/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang: l, pageId })
        })
        const startData = await startRes2.json()
        const game = startData.game
        const gameId = game?.id || null

        // 2. Si partie existante avec des guesses, recharge les tokens avec restauration serveur
        let finalData = preData
        if (game && game.guess_count > 0 && gameId) {
            const restoreUrl = `${todayUrl}&gameId=${gameId}`
            const restoreRes = await fetch(restoreUrl)
            if (restoreRes.ok) {
                finalData = await restoreRes.json()
            }

            // Récupère la liste des guesses pour l'historique
            const guessRes = await fetch(`/api/game/guesses?gameId=${gameId}`)
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

        const timerStart = finalData.firstGuessAt || game?.created_at
        const start = timerStart ? new Date(timerStart) : new Date()
        setStartedAt(start)
        setElapsed(Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000)))
        setLoading(false)
        setTimeout(() => inputRef.current?.focus(), 100)
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

        // ========== RÉVÉLATION OPTIMISTE ==========
        // 1. Check instantané côté client via hash set (~1ms)
        const inArticle = await isWordInArticle(word)
        setInput('')
        setInputError(null)

        // 2. Affichage IMMÉDIAT du résultat — pas d'attente serveur
        if (inArticle) {
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

        inputRef.current?.focus()

        // 3. Sync avec le serveur en BACKGROUND — transparent pour le joueur
        const guessBody = {
            gameId: gameState.gameId,
            pageId: gameState.pageData.id,
            lang,
            word,
            ...(!gameState.gameId && !alreadyWon && { previousGuesses: gameState.guesses.map(g => g.word) }),
        }

        fetch('/api/game/guess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guessBody),
        }).then(async res => {
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

            if (revealedTokens && revealedTokens.length > 0) {
                const revealedTokenMap = new Map<number, string>()
                for (const rt of revealedTokens) revealedTokenMap.set(rt.index, rt.value)
                const revealedTitleMap = new Map<number, string>()
                for (const rt of (revealedTitleIndices || [])) revealedTitleMap.set(rt.index, rt.value)

                // Animations
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
                fetch('/api/game/streak').then(r => r.json()).then(d => setStreak(d.streak || 0))
                confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } })
                setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.3 } }), 300)
                setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.7 } }), 600)
            }
        }).catch(() => {
            // Erreur réseau silencieuse — le guess est déjà affiché localement
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

    if (loading || !gameState) {
        return (
            <div style={{ fontFamily: 'var(--font-sans)', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
                <Header lang={lang} onLangChange={setLang} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setUsername(null) }} />
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
                        <Loader />
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
            setTimeout(() => setShareCopied(false), 2000)
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
            setTimeout(() => setChallengeCopied(false), 2000)
        })
    }

    return (
        <div style={{ fontFamily: 'var(--font-sans)', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
            <Header lang={lang} onLangChange={setLang} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setUsername(null) }} />

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

                    <TitleDisplay
                        titleWords={titleWords}
                        won={won}
                        guessCount={guessCount}
                        score={score}
                        streak={streak}
                        lang={lang}
                        revealAll={revealAll}
                        setRevealAll={setRevealAll}
                        wikipediaUrl={wikipediaUrl}
                        shareCopied={shareCopied}
                        onShare={handleShare}
                        challengeCopied={challengeCopied}
                        onChallenge={handleChallenge}
                        hintTokenIndex={hintTokenIndex}
                        justRevealedTitle={justRevealedTitle}
                        showHint={showHint}
                        isMobile={isMobile}
                        titleScoreStyle={titleScoreStyle}
                        scoreBoxStyle={scoreBoxStyle}
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
                        elapsed={elapsed}
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
                            showHint={showHint}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40, marginBottom: 20 }}>
                        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ padding: '8px 20px', borderRadius: 20, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                            {isMobile ? t.backToTopMobile : t.backToTop}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    )
}
