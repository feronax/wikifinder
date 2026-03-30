'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { isStopword } from '@/lib/wikipedia'
import { normalize, wordsMatch } from '@/lib/matching'
import { useIsMobile, calculateScore } from '@/lib/utils'
import confetti from 'canvas-confetti'
import Header from '@/components/Header'

type Token = {
    index: number
    type: 'word' | 'space' | 'punct'
    value: string
    visible?: boolean
    isStopword?: boolean
    isTitle?: boolean
    isHeading?: boolean
    headingLevel?: number
    length?: number
}

type TitleWord = {
    index: number
    value: string
    isStopword: boolean
    revealed: boolean
    length: number
}

type Guess = {
    word: string
    found: boolean
}

type GameState = {
    tokens: Token[]
    titleWords: TitleWord[]
    guesses: Guess[]
    guessCount: number
    won: boolean
    pageData: any
    gameId: string | null
}

const translations = {
    fr: {
        titleLabel: "Titre de l'article :",
        attempts: 'Tentatives :',
        placeholder: 'Entrez un mot...',
        validate: 'Valider',
        found: (n: number) => `🎉 Bravo ! Trouvé en ${n} tentatives !`,
        history: 'Mots essayés',
        noWords: 'Aucun mot encore',
        login: 'Connexion',
        logout: 'Déconnexion',
        revealAll: "👁️ Révéler tous les mots",
        hideAll: '🙈 Masquer les mots',
        readArticle: "📖 Lire l'article Wikipedia",
        score: 'Score',
        pts: 'pts',
        wordNotFound: 'Mot introuvable — aucune tentative comptée',
        alreadyGuessed: 'Mot déjà essayé',
        share: 'Partager',
        copied: 'Copié !',
        backToTop: '↑ Retour en haut',
        backToTopMobile: '↑',
    },
    en: {
        titleLabel: 'Article title:',
        attempts: 'Attempts:',
        placeholder: 'Enter a word...',
        validate: 'Submit',
        found: (n: number) => `🎉 Well done! Found in ${n} attempts!`,
        history: 'Tried words',
        noWords: 'No words yet',
        login: 'Login',
        logout: 'Logout',
        revealAll: '👁️ Reveal all words',
        hideAll: '🙈 Hide words',
        readArticle: '📖 Read Wikipedia article',
        score: 'Score',
        pts: 'pts',
        wordNotFound: 'Word not found — attempt not counted',
        alreadyGuessed: 'Already guessed',
        share: 'Share',
        copied: 'Copied!',
        backToTop: '↑ Back to top',
        backToTopMobile: '↑',
    }
}

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
    const [user, setUser] = useState<any>(null)
    const [username, setUsername] = useState<string | null>(null)
    const [clickedWord, setClickedWord] = useState<{ word: string, index: number } | null>(null)
    const [inputHistory, setInputHistory] = useState<string[]>([])
    const [inputHistoryIndex, setInputHistoryIndex] = useState<number>(-1)
    const [hintTokenIndex, setHintTokenIndex] = useState<number | null>(null)
    const [streak, setStreak] = useState<number | null>(null)
    const [shareCopied, setShareCopied] = useState(false)

    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

        const gameCreatedAt = game?.created_at
        setStartedAt(gameCreatedAt ? new Date(gameCreatedAt) : new Date())
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

        setSubmitting(true)
        setInputError(null)
        setInput('')

        try {
            const res = await fetch('/api/game/guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: gameState.gameId,
                    pageId: gameState.pageData.id,
                    lang,
                    word,
                    ...(!gameState.gameId && !alreadyWon && { previousGuesses: gameState.guesses.map(g => g.word) }),
                })
            })

            const data = await res.json()

            if (!res.ok) {
                setInputError(data.error || t.wordNotFound)
                setSubmitting(false)
                inputRef.current?.focus()
                return
            }

            const { isInText, revealedTokens, revealedTitleIndices, won: isWon, guessCount: serverCount } = data

            // Construit un map des tokens révélés pour un accès rapide
            const revealedTokenMap = new Map<number, string>()
            for (const rt of revealedTokens) {
                revealedTokenMap.set(rt.index, rt.value)
            }
            const revealedTitleMap = new Map<number, string>()
            for (const rt of revealedTitleIndices) {
                revealedTitleMap.set(rt.index, rt.value)
            }

            setGameState(prev => {
                if (!prev) return prev
                const newTokens = prev.tokens.map(token => {
                    if (revealedTokenMap.has(token.index)) {
                        return { ...token, value: revealedTokenMap.get(token.index)!, visible: true }
                    }
                    return token
                })
                const newTitleWords = prev.titleWords.map(tw => {
                    if (revealedTitleMap.has(tw.index)) {
                        return { ...tw, value: revealedTitleMap.get(tw.index)!, revealed: true }
                    }
                    return tw
                })
                return {
                    ...prev,
                    tokens: newTokens,
                    titleWords: newTitleWords,
                    guesses: [{ word, found: isInText }, ...prev.guesses],
                    // Ne pas incrémenter le score si déjà gagné
                    guessCount: alreadyWon ? prev.guessCount : (serverCount ?? prev.guessCount + 1),
                    won: isWon || prev.won,
                }
            })

            if (isWon && !alreadyWon) {
                fetch('/api/game/streak').then(r => r.json()).then(d => setStreak(d.streak || 0))
                // Confettis !
                confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } })
                setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.3 } }), 300)
                setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.7 } }), 600)
            }
        } catch {
            setInputError(lang === 'fr' ? 'Erreur réseau, réessayez.' : 'Network error, try again.')
        }

        setSubmitting(false)
        inputRef.current?.focus()
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
                        'Chargement...'
                    )}
                </div>
            </div>
        )
    }

    const { tokens, titleWords, guesses, guessCount, won, pageData } = gameState
    const wikipediaUrl = lang === 'fr' ? pageData?.wikipedia_url_fr : pageData?.wikipedia_url_en
    const score = calculateScore(guessCount, won)

    // Sur mobile, on n'affiche que les 3 derniers mots essayés
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

                    <div style={titleScoreStyle}>
                        <div style={{ flex: 1, textAlign: isMobile ? 'center' : 'left' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
                                {t.titleLabel}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', minHeight: 36 }}>
                                {titleWords.map((tw, i) => {
                                    const hintIdx = -(i + 1)
                                    if (tw.isStopword) {
                                        return <span key={i} style={{ fontSize: 22, color: 'var(--text-muted)', fontWeight: 300 }}>{tw.value}</span>
                                    }
                                    if (tw.revealed || won) {
                                        return <span key={i} style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent)' }}>{tw.value}</span>
                                    }
                                    const blockWidth = Math.max(20, (tw.length || 3) * 13)
                                    const showHintNow = hintTokenIndex === hintIdx
                                    return (
                                        <span key={i} onClick={() => showHint(hintIdx)} style={{
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            backgroundColor: 'var(--masked)', borderRadius: 4,
                                            width: blockWidth, height: '1.4em', verticalAlign: 'middle',
                                            cursor: 'pointer', fontSize: 13, fontWeight: 700,
                                            color: showHintNow ? 'var(--text)' : 'transparent',
                                            transition: 'color 0.15s', userSelect: 'none',
                                        }}>
                                            {tw.length}
                                        </span>
                                    )
                                })}
                            </div>

                            {won && (
                                <div style={{ marginTop: 14 }}>
                                    <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
                                        {t.found(guessCount)}
                                    </div>
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                                        <button onClick={() => setRevealAll(r => !r)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                            {revealAll ? t.hideAll : t.revealAll}
                                        </button>
                                        {wikipediaUrl && (
                                            <a href={wikipediaUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: 13, textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                {t.readArticle}
                                            </a>
                                        )}
                                        <button onClick={() => {
                                            const title = gameState.titleWords.filter(tw => !tw.isStopword).map(tw => tw.value).join(' ')
                                            const text = [
                                                `Wikifinder ${pageData?.date || ''}`,
                                                `${title}`,
                                                `${guessCount} ${lang === 'fr' ? 'tentatives' : 'guesses'} | Score: ${score.toLocaleString()}`,
                                                '',
                                                'https://wikifinder.vercel.app',
                                            ].join('\n')
                                            navigator.clipboard.writeText(text).then(() => {
                                                setShareCopied(true)
                                                setTimeout(() => setShareCopied(false), 2000)
                                            })
                                        }} style={{
                                            padding: '6px 14px', borderRadius: 6,
                                            border: '1px solid var(--accent)',
                                            backgroundColor: shareCopied ? 'var(--accent)' : 'transparent',
                                            color: shareCopied ? 'white' : 'var(--accent)',
                                            fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                            fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                                        }}>
                                            {shareCopied ? t.copied : t.share}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {won && (
                            <div style={scoreBoxStyle}>
                                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{t.score}</div>
                                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{score.toLocaleString()}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t.pts}</div>
                            </div>
                        )}
                        {won && streak !== null && streak > 0 && (
                            <div style={scoreBoxStyle}>
                                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Streak</div>
                                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{streak} 🔥</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{lang === 'fr' ? (streak === 1 ? 'jour' : 'jours') : (streak === 1 ? 'day' : 'days')}</div>
                            </div>
                        )}
                    </div>

                    {/* Zone Saisie + Historique mobile — sticky */}
                    <div style={{ 
                        position: 'sticky',
                        top: 0,
                        zIndex: 9, 
                        backgroundColor: 'var(--bg)', 
                        paddingTop: 12, 
                        paddingBottom: 16, 
                        borderBottom: '1px solid var(--border)', 
                        marginBottom: 24 
                    }}>
                        
                        {isMobile && (
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                                    {t.history}
                                </div>
                                {guesses.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.noWords}</div>
                                ) : (
                                    <div style={{
                                        display: 'flex',
                                        gap: 6,
                                        alignItems: 'center',
                                        overflowX: 'auto',
                                        WebkitOverflowScrolling: 'touch',
                                        scrollbarWidth: 'none',
                                        paddingBottom: 2,
                                    }}>
                                        {guesses.map((g, i) => (
                                            <div key={i} onClick={() => g.found && scrollToOccurrence(g.word)}
                                                style={{
                                                    backgroundColor: g.found ? 'var(--revealed)' : 'var(--surface)',
                                                    border: '1px solid ' + (g.found ? 'var(--accent)' : 'var(--border)'),
                                                    padding: '4px 8px', borderRadius: 4, fontSize: 13,
                                                    color: g.found ? 'var(--accent)' : 'var(--text-muted)',
                                                    fontWeight: g.found ? 600 : 400,
                                                    cursor: g.found ? 'pointer' : 'default',
                                                    whiteSpace: 'nowrap',
                                                    flexShrink: 0,
                                                }}>
                                                {g.word}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {(() => {
                            const wordTokens = tokens.filter(t => t.type === 'word' && !t.isStopword)
                            const revealed = wordTokens.filter(t => t.visible).length
                            const total = wordTokens.length
                            const pct = total > 0 ? Math.round((revealed / total) * 100) : 0
                            return (
                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
                                            {t.attempts} <span style={{ color: 'var(--text)', fontWeight: 700 }}>{guessCount}</span>
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                                            {pct}%
                                        </div>
                                    </div>
                                    <div style={{
                                        height: 6,
                                        borderRadius: 3,
                                        backgroundColor: 'var(--border)',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${pct}%`,
                                            backgroundColor: 'var(--accent)',
                                            borderRadius: 3,
                                            transition: 'width 0.4s ease',
                                        }} />
                                    </div>
                                </div>
                            )
                        })()}

                        <div style={{ display: 'flex', gap: 8 }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <input ref={inputRef} value={input}
                                        onChange={e => { setInput(e.target.value); setInputError(null) }}
                                        onKeyDown={handleKeyDown}
                                        placeholder={t.placeholder}
                                        style={{
                                            width: '100%', padding: '12px 16px', fontSize: 16, borderRadius: 8,
                                            border: '1px solid ' + (inputError ? '#e53e3e' : 'var(--border)'),
                                            backgroundColor: 'var(--surface)', color: 'var(--text)',
                                            outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
                                        }}
                                    />
                                    {inputError && (
                                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, fontSize: 12, color: '#e53e3e', fontWeight: 500 }}>
                                            {inputError}
                                        </div>
                                    )}
                                </div>
                                <button onClick={handleGuess} disabled={!input.trim() || submitting} style={{
                                    padding: '12px 24px', fontSize: 15, fontWeight: 600, borderRadius: 8, border: 'none',
                                    backgroundColor: 'var(--accent)', color: 'white',
                                    cursor: (!input.trim() || submitting) ? 'default' : 'pointer',
                                    opacity: (!input.trim() || submitting) ? 0.6 : 1,
                                    transition: 'background-color 0.2s', whiteSpace: 'nowrap',
                                }}>
                                    {submitting ? '...' : t.validate}
                                </button>
                            </div>
                    </div>

                    <div style={{ fontSize: 15, color: 'var(--text)', paddingTop: inputError ? 20 : 0 }}>
                        {(() => {
                            const elements: React.ReactNode[] = []
                            let i = 0

                            while (i < tokens.length) {
                                const token = tokens[i]

                                if (token.type === 'word' && token.isHeading) {
                                    const headingTokens: React.ReactNode[] = []
                                    const level = token.headingLevel || 2

                                    while (i < tokens.length && (
                                        (tokens[i].type === 'word' && tokens[i].isHeading) ||
                                        (tokens[i].type === 'space' && !tokens[i].value.includes('\n'))
                                    )) {
                                        const tk = tokens[i]
                                        if (tk.type === 'space') {
                                            headingTokens.push(<span key={i}>{tk.value}</span>)
                                        } else if (tk.visible) {
                                            headingTokens.push(
                                                <span key={i} data-word={tk.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, '').toLowerCase()}
                                                    style={{ color: tk.isTitle ? 'var(--accent)' : 'var(--text)' }}>
                                                    {tk.value}
                                                </span>
                                            )
                                        } else if (revealAll) {
                                            headingTokens.push(
                                                <span key={i} style={{ color: tk.isTitle ? 'var(--accent)' : 'var(--text-muted)', fontStyle: 'italic' }}>
                                                    {tk.value}
                                                </span>
                                            )
                                        } else {
                                            const idx = i
                                            const showHintNow = hintTokenIndex === idx
                                            headingTokens.push(
                                                <span key={i} onClick={() => showHint(idx)} style={{
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    backgroundColor: 'var(--masked)', borderRadius: 3,
                                                    minWidth: `${(tk.length || 3) * 8}px`, height: '1.2em',
                                                    verticalAlign: 'middle', margin: '0 1px',
                                                    cursor: 'pointer', fontSize: 9, fontWeight: 700,
                                                    color: showHintNow ? 'var(--text)' : 'transparent',
                                                    transition: 'color 0.15s', userSelect: 'none',
                                                }}>
                                                    {tk.length}
                                                </span>
                                            )
                                        }
                                        i++
                                    }

                                    elements.push(
                                        <div key={`heading-${i}`} style={{ fontWeight: 700, fontSize: level === 2 ? '1.2em' : '1.05em', marginTop: '1.5em', marginBottom: '0.5em', paddingBottom: '0.3em', borderBottom: '1px solid var(--border)', lineHeight: 1.4, textAlign: 'left' }}>
                                            {headingTokens}
                                        </div>
                                    )
                                    continue
                                }

                                if (token.type === 'space' && token.value.includes('\n')) { i++; continue }

                                const lineTokens: React.ReactNode[] = []
                                while (i < tokens.length &&
                                    !(tokens[i].type === 'space' && tokens[i].value.includes('\n')) &&
                                    !(tokens[i].type === 'word' && tokens[i].isHeading)
                                ) {
                                    const tk = tokens[i]
                                    if (tk.type === 'space' || tk.type === 'punct') {
                                        lineTokens.push(<span key={i}>{tk.value}</span>)
                                    } else if (tk.visible) {
                                        lineTokens.push(
                                            <span key={i} data-word={tk.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, '').toLowerCase()}
                                                style={{ fontWeight: tk.isTitle ? 700 : 400, color: tk.isTitle ? 'var(--accent)' : 'var(--text)' }}>
                                                {tk.value}
                                            </span>
                                        )
                                    } else if (revealAll) {
                                        lineTokens.push(
                                            <span key={i} style={{ color: tk.isTitle ? 'var(--accent)' : 'var(--text-muted)', fontStyle: 'italic' }}>
                                                {tk.value}
                                            </span>
                                        )
                                    } else {
                                        const idx = i
                                        const showHintNow = hintTokenIndex === idx
                                        lineTokens.push(
                                            <span key={i} onClick={() => showHint(idx)} style={{
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                backgroundColor: 'var(--masked)', borderRadius: 3,
                                                minWidth: `${(tk.length || 3) * 8}px`, height: '1.5em',
                                                verticalAlign: 'middle', margin: '0 1px',
                                                cursor: 'pointer', fontSize: 10, fontWeight: 700,
                                                color: showHintNow ? 'var(--text)' : 'transparent',
                                                transition: 'color 0.15s', userSelect: 'none',
                                            }}>
                                                {tk.length}
                                            </span>
                                        )
                                    }
                                    i++
                                }

                                if (lineTokens.length > 0) {
                                    elements.push(<span key={`line-${i}`} style={{ lineHeight: 2.6, textAlign: 'left' }}>{lineTokens}</span>)
                                }
                                i++
                            }

                            return elements
                        })()}
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