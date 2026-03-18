'use client'

import { useEffect, useState, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

type Token = {
    type: 'word' | 'space' | 'punct'
    value: string
    visible?: boolean
    isStopword?: boolean
    isTitle?: boolean
    length?: number
}

type TitleWord = {
    value: string
    isStopword: boolean
    revealed: boolean
}

const translations = {
    fr: {
        titleLabel: "Titre de l'article :",
        attempts: 'Tentatives :',
        placeholder: 'Entrez un mot...',
        validate: 'Valider',
        found: (n: number) => `🎉 Bravo ! Trouvé en ${n} tentatives !`,
        history: 'Tentatives :',
        login: 'Connexion',
        logout: 'Déconnexion',
    },
    en: {
        titleLabel: 'Article title:',
        attempts: 'Attempts:',
        placeholder: 'Enter a word...',
        validate: 'Submit',
        found: (n: number) => `🎉 Well done! Found in ${n} attempts!`,
        history: 'Attempts:',
        login: 'Login',
        logout: 'Logout',
    }
}

export default function GamePage() {
    const [tokens, setTokens] = useState<Token[]>([])
    const [titleWords, setTitleWords] = useState<TitleWord[]>([])
    const [guesses, setGuesses] = useState<string[]>([])
    const [input, setInput] = useState('')
    const [guessCount, setGuessCount] = useState(0)
    const [won, setWon] = useState(false)
    const [lang, setLang] = useState<'fr' | 'en'>('fr')
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [pageId, setPageId] = useState<string | null>(null)
    const [gameId, setGameId] = useState<string | null>(null)
    const [startedAt, setStartedAt] = useState<Date | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const supabase = createSupabaseBrowserClient()
    const [username, setUsername] = useState<string | null>(null)


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

    useEffect(() => { loadGame(lang) }, [lang])

    async function loadGame(l: 'fr' | 'en') {
        setLoading(true)
        const res = await fetch(`/api/game/today?lang=${l}`)
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()
        setTokens(data.tokens)
        setTitleWords(data.titleWords)
        setPageId(data.id)
        setGuesses([])
        setGuessCount(0)
        setWon(false)
        setStartedAt(new Date())
        setLoading(false)
        setTimeout(() => inputRef.current?.focus(), 100)

        // Démarre ou reprend une partie si connecté
        const startRes = await fetch('/api/game/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang: l, pageId: data.id })
        })
        const startData = await startRes.json()
        if (startData.game) {
            const game = startData.game
            setGameId(game.id)

            if (game.completed) {
                setWon(true)
            }

            // Reprend les tentatives précédentes
            if (game.guess_count > 0) {
                const guessRes = await fetch(`/api/game/guesses?gameId=${game.id}`)
                const guessData = await guessRes.json()
                const previousGuesses: string[] = guessData.guesses || []

                setGuessCount(game.guess_count)
                setGuesses(previousGuesses.slice().reverse())

                // Rejoue chaque mot pour révéler les tokens
                let restoredTokens = [...data.tokens]
                let restoredTitleWords = [...data.titleWords]

                for (const word of previousGuesses) {
                    const clean = word.toLowerCase()
                    restoredTokens = restoredTokens.map((token: any) => {
                        if (token.type !== 'word' || token.visible) return token
                        const tokenClean = token.value.replace(/[^a-zA-ZÀ-ÿ'-]/g, '').toLowerCase()
                        return tokenClean === clean ? { ...token, visible: true } : token
                    })
                    restoredTitleWords = restoredTitleWords.map((tw: any) => {
                        if (tw.revealed || tw.isStopword) return tw
                        return tw.value.toLowerCase() === clean ? { ...tw, revealed: true } : tw
                    })
                }

                setTokens(restoredTokens)
                setTitleWords(restoredTitleWords)
            }
        }
    }

    async function handleGuess() {
        const word = input.trim()
        if (!word || won) return

        const clean = word.toLowerCase()
        const newGuessCount = guessCount + 1
        setGuessCount(newGuessCount)
        setInput('')

        const newTokens = tokens.map(token => {
            if (token.type !== 'word' || token.visible) return token
            const tokenClean = token.value.replace(/[^a-zA-ZÀ-ÿ'-]/g, '').toLowerCase()
            return tokenClean === clean ? { ...token, visible: true } : token
        })
        setTokens(newTokens)

        const newTitleWords = titleWords.map(tw => {
            if (tw.revealed || tw.isStopword) return tw
            return tw.value.toLowerCase() === clean ? { ...tw, revealed: true } : tw
        })
        setTitleWords(newTitleWords)

        const allFound = newTitleWords
            .filter(tw => !tw.isStopword)
            .every(tw => tw.revealed)
        const isWon = allFound

        if (isWon) setWon(true)
        setGuesses(prev => [word, ...prev])

        // Sauvegarde si connecté
        if (gameId) {
            const now = new Date()
            const duration = startedAt ? Math.floor((now.getTime() - startedAt.getTime()) / 1000) : 0
            await fetch('/api/game/guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId,
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

    if (loading || titleWords.length === 0) return <div style={{ padding: 40 }}>Chargement...</div>

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ margin: 0 }}>Wikifinder</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {user ? (
                        <span style={{ fontSize: 14, color: '#666' }}>
                            <a href="/profile" style={{ color: '#1a1a1a', textDecoration: 'none', fontWeight: 'bold' }}>
                                {username || user.email}
                            </a>
                            <a href="/history" style={{ marginLeft: 12, fontSize: 13, color: '#1a1a1a', textDecoration: 'none', fontWeight: 'bold' }}>
                                Historique
                            </a>
                            <a href="/leaderboard" style={{ fontSize: 14, color: '#1a1a1a', textDecoration: 'none' }}>
                                Classement
                            </a>
                            <button onClick={async () => { await supabase.auth.signOut(); setUser(null) }}
                                style={{ marginLeft: 8, fontSize: 13, color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}>
                                {t.logout}
                            </button>
                        </span>
                    ) : (
                        <a href="/auth/login" style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 'bold', textDecoration: 'none' }}>
                            {t.login}
                        </a>
                    )}
                    <div>
                        <button onClick={() => setLang('fr')} style={{ marginRight: 8, fontWeight: lang === 'fr' ? 'bold' : 'normal' }}>FR</button>
                        <button onClick={() => setLang('en')} style={{ fontWeight: lang === 'en' ? 'bold' : 'normal' }}>EN</button>
                    </div>
                </div>
            </div>

            {/* Titre masqué */}
            <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>{t.titleLabel}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {titleWords.map((tw, i) => {
                        if (tw.isStopword) {
                            return <span key={i} style={{ fontSize: 20, color: '#999' }}>{tw.value}</span>
                        }
                        if (tw.revealed || won) {
                            return (
                                <span key={i} style={{
                                    fontSize: 20, fontWeight: 'bold',
                                    color: won ? '#2e7d32' : '#1565c0',
                                    backgroundColor: won ? '#e8f5e9' : '#e3f2fd',
                                    padding: '2px 8px', borderRadius: 4
                                }}>
                                    {tw.value}
                                </span>
                            )
                        }
                        return (
                            <span key={i} style={{
                                display: 'inline-block',
                                backgroundColor: '#e0e0e0',
                                borderRadius: 3,
                                width: 80,
                                height: '1.2em',
                                verticalAlign: 'middle',
                            }} />
                        )
                    })}
                </div>
                {won && <div style={{ marginTop: 12, color: '#2e7d32', fontWeight: 'bold' }}>{t.found(guessCount)}</div>}
            </div>

            {/* Score + saisie */}
            <div style={{ marginBottom: 8, fontSize: 16 }}>{t.attempts} <strong>{guessCount}</strong></div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGuess()}
                    placeholder={t.placeholder}
                    disabled={won}
                    style={{ flex: 1, padding: '8px 12px', fontSize: 16, borderRadius: 6, border: '1px solid #ccc' }}
                />
                <button onClick={handleGuess} disabled={won}
                    style={{ padding: '8px 20px', fontSize: 16, borderRadius: 6, cursor: 'pointer' }}>
                    {t.validate}
                </button>
            </div>

            {/* Texte masqué */}
            <div style={{ lineHeight: 2.4, fontSize: 15 }}>
                {tokens.map((token, i) => {
                    if (token.type === 'space') return <span key={i}>{token.value}</span>
                    if (token.type === 'punct') return <span key={i}>{token.value}</span>
                    if (token.visible) {
                        return (
                            <span key={i} style={{
                                backgroundColor: token.isTitle ? '#fff9c4' : token.isStopword ? 'transparent' : '#e3f2fd',
                                borderRadius: 3, padding: '1px 2px',
                                fontWeight: token.isTitle ? 'bold' : 'normal'
                            }}>
                                {token.value}
                            </span>
                        )
                    }
                    return (
                        <span key={i} style={{
                            display: 'inline-block',
                            backgroundColor: '#e0e0e0',
                            borderRadius: 3,
                            minWidth: `${(token.length || 3) * 8}px`,
                            height: '0.85em',
                            verticalAlign: 'middle',
                            margin: '0 1px'
                        }} />
                    )
                })}
            </div>

            {/* Historique */}
            {guesses.length > 0 && (
                <div style={{ marginTop: 32 }}>
                    <h3>{t.history}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {guesses.map((g, i) => (
                            <span key={i} style={{
                                backgroundColor: '#f0f0f0', padding: '4px 10px',
                                borderRadius: 16, fontSize: 14
                            }}>{g}</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}