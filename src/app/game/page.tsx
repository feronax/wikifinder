'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import Header from '@/components/Header'

type Token = {
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
    }
}

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    return isMobile;
}

function calculateScore(guessCount: number, completed: boolean): number {
    if (!completed || guessCount > 400) return 0
    const wRaw = Math.max(0, guessCount - 70)
    const w = wRaw / (400 - 70)
    return Math.round(5000 * Math.exp(-3.5 * w))
}

function normalize(word: string): string {
    return word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

async function checkWordExists(word: string, lang: 'fr' | 'en'): Promise<boolean> {
    try {
        const url = `https://${lang}.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(word)}&format=json&origin=*`
        const res = await fetch(url)
        const data = await res.json()
        const pages = data.query.pages
        return !('-1' in pages)
    } catch {
        return true
    }
}

function wordsMatch(input: string, token: string): boolean {
    const normInput = normalize(input)
    const normToken = normalize(token)
    if (normInput === normToken) return true
    if (normToken === normInput + 's') return true
    if (normToken === normInput + 'x') return true
    if (normToken === normInput + 'es') return true
    if (normInput === normToken + 's') return true
    if (normInput === normToken + 'x') return true
    if (normInput === normToken + 'es') return true
    if (normToken.endsWith('aux') && normInput === normToken.slice(0, -3) + 'al') return true
    if (normInput.endsWith('aux') && normToken === normInput.slice(0, -3) + 'al') return true
    return false
}

// Sépare les mots autour des apostrophes : "d'un" => ["d", "un"]
function splitOnApostrophe(word: string): string[] {
    const parts = word.split(/[''']/)
    return parts.filter(p => p.length > 0)
}

export default function GamePage() {
    const [gameState, setGameState] = useState<GameState | null>(null)
    const [revealAll, setRevealAll] = useState(false)
    const [lang, setLang] = useState<'fr' | 'en'>('fr')
    const [loading, setLoading] = useState(true)
    const [input, setInput] = useState('')
    const [inputError, setInputError] = useState<string | null>(null)
    const [checkingWord, setCheckingWord] = useState(false)
    const [startedAt, setStartedAt] = useState<Date | null>(null)
    const [user, setUser] = useState<any>(null)
    const [username, setUsername] = useState<string | null>(null)
    const [clickedWord, setClickedWord] = useState<{ word: string, index: number } | null>(null)
    const [inputHistory, setInputHistory] = useState<string[]>([])
    const [inputHistoryIndex, setInputHistoryIndex] = useState<number>(-1)
    const [hintTokenIndex, setHintTokenIndex] = useState<number | null>(null)
    
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
        setRevealAll(false)
        setClickedWord(null)
        setHintTokenIndex(null)

        const url = date
            ? `/api/game/today?lang=${l}&date=${date}`
            : `/api/game/today?lang=${l}`
        const res = await fetch(url)
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()

        const startRes = await fetch('/api/game/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang: l, pageId: data.id })
        })
        const startData = await startRes.json()

        let finalState: GameState

        if (startData.game && startData.game.guess_count > 0) {
            const game = startData.game
            const guessRes = await fetch(`/api/game/guesses?gameId=${game.id}`)
            const guessData = await guessRes.json()
            const previousGuesses: string[] = guessData.guesses || []

            let restoredTokens = [...data.tokens]
            let restoredTitleWords = [...data.titleWords]

            for (const word of previousGuesses) {
                const variants = splitOnApostrophe(word)
                for (const variant of variants) {
                    restoredTokens = restoredTokens.map((token: any) => {
                        if (token.type !== 'word' || token.visible || token.isStopword) return token
                        const tokenClean = token.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, '')
                        return wordsMatch(variant, tokenClean) ? { ...token, visible: true } : token
                    })
                    restoredTitleWords = restoredTitleWords.map((tw: any) => {
                        if (tw.revealed || tw.isStopword) return tw
                        return wordsMatch(variant, tw.value) ? { ...tw, revealed: true } : tw
                    })
                }
            }

            const guessesWithStatus = previousGuesses.map(word => {
                const variants = splitOnApostrophe(word)
                const found = variants.some(variant =>
                    restoredTokens.some((token: any) =>
                        token.type === 'word' && !token.isStopword &&
                        wordsMatch(variant, token.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, ''))
                    )
                )
                return { word, found }
            })

            finalState = {
                tokens: restoredTokens,
                titleWords: restoredTitleWords,
                guesses: guessesWithStatus.slice().reverse(),
                guessCount: game.guess_count,
                won: game.completed,
                pageData: data,
                gameId: game.id,
            }
        } else {
            finalState = {
                tokens: data.tokens,
                titleWords: data.titleWords,
                guesses: [],
                guessCount: 0,
                won: false,
                pageData: data,
                gameId: startData.game?.id || null,
            }
        }

        setGameState(finalState)
        setStartedAt(new Date())
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
        if (!gameState) return
        const word = input.trim()
        if (!word) return
        const clean = word.toLowerCase()

        setInputHistory(prev => [word, ...prev.filter(w => w !== word)])
        setInputHistoryIndex(-1)

        const { isStopword } = await import('@/lib/wikipedia')
        if (isStopword(clean, lang)) {
            setInput(''); setInputError(null); inputRef.current?.focus(); return
        }

        if (gameState.guesses.some(g => wordsMatch(g.word, word))) {
            setInput(''); setInputError(null); inputRef.current?.focus(); return
        }

        // Sépare sur apostrophe pour la recherche dans le texte
        const variants = splitOnApostrophe(word)

        const isInText = variants.some(variant =>
            gameState.tokens.some(token =>
                token.type === 'word' && !token.isStopword &&
                wordsMatch(variant, token.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, ''))
            )
        )

        if (!isInText) {
            setCheckingWord(true)
            const exists = await checkWordExists(word, lang)
            setCheckingWord(false)
            if (!exists) {
                setInputError(t.wordNotFound)
                inputRef.current?.focus()
                return
            }
        }

        setInputError(null)
        const alreadyWon = gameState.won
        const newGuessCount = alreadyWon ? gameState.guessCount : gameState.guessCount + 1
        setInput('')

        const newTokens = gameState.tokens.map(token => {
            if (token.type !== 'word' || token.visible || token.isStopword) return token
            const tokenClean = token.value.replace(/[^a-zA-ZÀ-ÿ0-9'-]/g, '')
            return variants.some(v => wordsMatch(v, tokenClean)) ? { ...token, visible: true } : token
        })

        const newTitleWords = gameState.titleWords.map(tw => {
            if (tw.revealed || tw.isStopword) return tw
            return variants.some(v => wordsMatch(v, tw.value)) ? { ...tw, revealed: true } : tw
        })

        const allFound = newTitleWords.filter(tw => !tw.isStopword).every(tw => tw.revealed)
        const isWon = allFound

        setGameState(prev => prev ? {
            ...prev,
            tokens: newTokens,
            titleWords: newTitleWords,
            guesses: [{ word, found: isInText }, ...prev.guesses],
            guessCount: newGuessCount,
            won: isWon || prev.won,
        } : prev)

        if (gameState.gameId && !alreadyWon) {
            const now = new Date()
            const duration = startedAt ? Math.floor((now.getTime() - startedAt.getTime()) / 1000) : 0
            await fetch('/api/game/guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: gameState.gameId,
                    word,
                    guessCount: newGuessCount,
                    completed: isWon,
                    completedAt: isWon ? now.toISOString() : null,
                    durationSeconds: isWon ? duration : null,
                })
            })
        }

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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
                    Chargement...
                </div>
            </div>
        )
    }

    const { tokens, titleWords, guesses, guessCount, won, pageData } = gameState
    const wikipediaUrl = lang === 'fr' ? pageData?.wikipedia_url_fr : pageData?.wikipedia_url_en
    const score = calculateScore(guessCount, won)

    // Sur mobile, on n'affiche que les 3 derniers mots essayés
    const displayedGuesses = isMobile ? guesses.slice(0, 3) : guesses

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
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                        {displayedGuesses.map((g, i) => (
                                            <div key={i} onClick={() => g.found && scrollToOccurrence(g.word)}
                                                style={{
                                                    backgroundColor: g.found ? 'var(--revealed)' : 'var(--surface)',
                                                    border: '1px solid ' + (g.found ? 'var(--accent)' : 'var(--border)'),
                                                    padding: '4px 8px', borderRadius: 4, fontSize: 13,
                                                    color: g.found ? 'var(--accent)' : 'var(--text-muted)',
                                                    fontWeight: g.found ? 600 : 400,
                                                    cursor: g.found ? 'pointer' : 'default',
                                                }}>
                                                {g.word}
                                            </div>
                                        ))}
                                        {guesses.length > 3 && (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                +{guesses.length - 3}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ marginBottom: 8, fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, textAlign: isMobile ? 'center' : 'left' }}>
                            {t.attempts} <span style={{ color: 'var(--text)', fontWeight: 700 }}>{guessCount}</span>
                        </div>
                        
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
                            <button onClick={handleGuess} disabled={!input.trim() || checkingWord} style={{
                                padding: '12px 24px', fontSize: 15, fontWeight: 600, borderRadius: 8, border: 'none',
                                backgroundColor: 'var(--accent)', color: 'white',
                                cursor: (!input.trim() || checkingWord) ? 'default' : 'pointer',
                                opacity: (!input.trim() || checkingWord) ? 0.6 : 1,
                                transition: 'background-color 0.2s', whiteSpace: 'nowrap',
                            }}>
                                {checkingWord ? '...' : t.validate}
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
                            {isMobile ? '↑' : '↑ Retour en haut'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    )
}