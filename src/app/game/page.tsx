'use client'

import { useEffect, useState, useRef } from 'react'
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
        revealAll: '👁️ Révéler tous les mots',
        hideAll: '🙈 Masquer les mots',
        readArticle: '📖 Lire l\'article Wikipedia',
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
    }
}

export default function GamePage() {
    const [tokens, setTokens] = useState<Token[]>([])
    const [titleWords, setTitleWords] = useState<TitleWord[]>([])
    const [guesses, setGuesses] = useState<string[]>([])
    const [input, setInput] = useState('')
    const [guessCount, setGuessCount] = useState(0)
    const [won, setWon] = useState(false)
    const [revealAll, setRevealAll] = useState(false)
    const [lang, setLang] = useState<'fr' | 'en'>('fr')
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [username, setUsername] = useState<string | null>(null)
    const [pageId, setPageId] = useState<string | null>(null)
    const [pageData, setPageData] = useState<any>(null)
    const [gameId, setGameId] = useState<string | null>(null)
    const [startedAt, setStartedAt] = useState<Date | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const supabase = createSupabaseBrowserClient()

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
        setPageData(data)
        setGuesses([])
        setGuessCount(0)
        setWon(false)
        setRevealAll(false)
        setStartedAt(new Date())
        setLoading(false)
        setTimeout(() => inputRef.current?.focus(), 100)

        const startRes = await fetch('/api/game/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang: l, pageId: data.id })
        })
        const startData = await startRes.json()
        if (startData.game) {
            const game = startData.game
            setGameId(game.id)

            if (game.completed) setWon(true)

            if (game.guess_count > 0) {
                const guessRes = await fetch(`/api/game/guesses?gameId=${game.id}`)
                const guessData = await guessRes.json()
                const previousGuesses: string[] = guessData.guesses || []

                setGuessCount(game.guess_count)
                setGuesses(previousGuesses.slice().reverse())

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
        if (!word) return

        const clean = word.toLowerCase()

        // Ignore si le mot a déjà été essayé
        if (guesses.some(g => g.toLowerCase() === clean)) {
            setInput('')
            inputRef.current?.focus()
            return
        }

        const alreadyWon = won
        const newGuessCount = alreadyWon ? guessCount : guessCount + 1
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

        if (gameId && !alreadyWon) {
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

    if (loading || titleWords.length === 0) {
        return (
            <div style={{ fontFamily: 'var(--font-sans)', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
                <Header lang={lang} onLangChange={setLang} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setUsername(null) }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
                    Chargement...
                </div>
            </div>
        )
    }

    const wikipediaUrl = lang === 'fr' ? pageData?.wikipedia_url_fr : pageData?.wikipedia_url_en

    return (
        <div style={{ fontFamily: 'var(--font-sans)', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
            <Header lang={lang} onLangChange={setLang} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setUsername(null) }} />

            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px', display: 'flex', gap: 32 }}>

                {/* Colonne gauche — historique */}
                <div style={{
                    width: 180,
                    flexShrink: 0,
                    position: 'sticky',
                    top: 80,
                    alignSelf: 'flex-start',
                    maxHeight: 'calc(100vh - 100px)',
                    overflowY: 'auto',
                }}>
                    <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        marginBottom: 12,
                    }}>
                        {t.history}
                    </div>
                    {guesses.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            {t.noWords}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {guesses.map((g, i) => (
                                <div key={i} style={{
                                    backgroundColor: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    padding: '6px 12px',
                                    borderRadius: 6,
                                    fontSize: 14,
                                    color: 'var(--text-muted)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>
                                    {g}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Colonne droite — jeu */}
                <div style={{ flex: 1, minWidth: 0 }}>

                    {/* Titre masqué */}
                    <div style={{
                        marginBottom: 28,
                        padding: '20px 24px',
                        backgroundColor: 'var(--surface)',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow)',
                    }}>
                        <div style={{
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'var(--text-muted)',
                            marginBottom: 12,
                        }}>
                            {t.titleLabel}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', minHeight: 36 }}>
                            {titleWords.map((tw, i) => {
                                if (tw.isStopword) {
                                    return <span key={i} style={{ fontSize: 22, color: 'var(--text-muted)', fontWeight: 300 }}>{tw.value}</span>
                                }
                                if (tw.revealed || won) {
                                    return (
                                        <span key={i} style={{
                                            fontSize: 22,
                                            fontWeight: 600,
                                            color: 'var(--accent)',
                                        }}>
                                            {tw.value}
                                        </span>
                                    )
                                }
                                return (
                                    <span key={i} style={{
                                        display: 'inline-block',
                                        backgroundColor: 'var(--masked)',
                                        borderRadius: 4,
                                        width: 80,
                                        height: '1.3em',
                                        verticalAlign: 'middle',
                                    }} />
                                )
                            })}
                        </div>

                        {won && (
                            <div style={{ marginTop: 14 }}>
                                <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
                                    {t.found(guessCount)}
                                </div>
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => setRevealAll(r => !r)}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: 6,
                                            border: '1px solid var(--border)',
                                            backgroundColor: 'var(--surface)',
                                            color: 'var(--text)',
                                            fontSize: 13,
                                            cursor: 'pointer',
                                            fontFamily: 'var(--font-sans)',
                                        }}
                                    >
                                        {revealAll ? t.hideAll : t.revealAll}
                                    </button>
                                    {wikipediaUrl && (
                                        <a
                                            href={wikipediaUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: 6,
                                                border: '1px solid var(--accent)',
                                                color: 'var(--accent)',
                                                fontSize: 13,
                                                textDecoration: 'none',
                                                fontWeight: 600,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                            }}
                                        >
                                            {t.readArticle}
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Score + saisie */}
                    <div style={{ marginBottom: 6, fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
                        {t.attempts} <span style={{ color: 'var(--text)', fontWeight: 700 }}>{guessCount}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleGuess()}
                            placeholder={t.placeholder}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                fontSize: 16,
                                borderRadius: 8,
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--surface)',
                                color: 'var(--text)',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                            }}
                        />
                        <button
                            onClick={handleGuess}
                            disabled={!input.trim()}
                            style={{
                                padding: '12px 24px',
                                fontSize: 15,
                                fontWeight: 600,
                                borderRadius: 8,
                                border: 'none',
                                backgroundColor: 'var(--accent)',
                                color: 'white',
                                cursor: !input.trim() ? 'default' : 'pointer',
                                opacity: !input.trim() ? 0.6 : 1,
                                transition: 'background-color 0.2s',
                            }}
                        >
                            {t.validate}
                        </button>
                    </div>

                    {/* Texte masqué */}
                    <div style={{ fontSize: 15, color: 'var(--text)' }}>
                        {(() => {
                            const elements: React.ReactNode[] = []
                            let i = 0

                            while (i < tokens.length) {
                                const token = tokens[i]

                                // Détecte un bloc de titre (séquence de tokens isHeading)
                                if (token.type === 'word' && token.isHeading) {
                                    const headingTokens: React.ReactNode[] = []
                                    const level = token.headingLevel || 2

                                    while (i < tokens.length && (
                                        (tokens[i].type === 'word' && tokens[i].isHeading) ||
                                        (tokens[i].type === 'space' && !tokens[i].value.includes('\n'))
                                    )) {
                                        const t = tokens[i]
                                        if (t.type === 'space') {
                                            headingTokens.push(<span key={i}>{t.value}</span>)
                                        } else if (t.visible) {
                                            headingTokens.push(
                                                <span key={i} style={{ color: t.isTitle ? 'var(--accent)' : 'var(--text)' }}>
                                                    {t.value}
                                                </span>
                                            )
                                        } else if (revealAll) {
                                            headingTokens.push(
                                                <span key={i} style={{ color: t.isTitle ? 'var(--accent)' : 'var(--text-muted)', fontStyle: 'italic' }}>
                                                    {t.value}
                                                </span>
                                            )
                                        } else {
                                            headingTokens.push(
                                                <span key={i} style={{
                                                    display: 'inline-block',
                                                    backgroundColor: 'var(--masked)',
                                                    borderRadius: 3,
                                                    minWidth: `${(t.length || 3) * 8}px`,
                                                    height: '1.1em',
                                                    verticalAlign: 'middle',
                                                    margin: '0 1px',
                                                }} />
                                            )
                                        }
                                        i++
                                    }

                                    elements.push(
                                        <div key={`heading-${i}`} style={{
                                            fontWeight: 700,
                                            fontSize: level === 2 ? '1.2em' : '1.05em',
                                            marginTop: '1.5em',
                                            marginBottom: '0.5em',
                                            paddingBottom: '0.3em',
                                            borderBottom: '1px solid var(--border)',
                                            lineHeight: 1.4,
                                        }}>
                                            {headingTokens}
                                        </div>
                                    )
                                    continue
                                }

                                // Saut de ligne
                                if (token.type === 'space' && token.value.includes('\n')) {
                                    i++
                                    continue
                                }

                                // Texte normal — accumule jusqu'au prochain saut de ligne ou heading
                                const lineTokens: React.ReactNode[] = []
                                while (i < tokens.length &&
                                    !(tokens[i].type === 'space' && tokens[i].value.includes('\n')) &&
                                    !(tokens[i].type === 'word' && tokens[i].isHeading)
                                ) {
                                    const t = tokens[i]
                                    if (t.type === 'space' || t.type === 'punct') {
                                        lineTokens.push(<span key={i}>{t.value}</span>)
                                    } else if (t.visible) {
                                        lineTokens.push(
                                            <span key={i} style={{
                                                fontWeight: t.isTitle ? 700 : 400,
                                                color: t.isTitle ? 'var(--accent)' : 'var(--text)',
                                            }}>
                                                {t.value}
                                            </span>
                                        )
                                    } else if (revealAll) {
                                        lineTokens.push(
                                            <span key={i} style={{
                                                color: t.isTitle ? 'var(--accent)' : 'var(--text-muted)',
                                                fontStyle: 'italic',
                                            }}>
                                                {t.value}
                                            </span>
                                        )
                                    } else {
                                        lineTokens.push(
                                            <span key={i} style={{
                                                display: 'inline-block',
                                                backgroundColor: 'var(--masked)',
                                                borderRadius: 3,
                                                minWidth: `${(t.length || 3) * 8}px`,
                                                height: '1.5em',
                                                verticalAlign: 'middle',
                                                margin: '0 1px',
                                            }} />
                                        )
                                    }
                                    i++
                                }

                                if (lineTokens.length > 0) {
                                    elements.push(
                                        <span key={`line-${i}`} style={{ lineHeight: 2.6 }}>
                                            {lineTokens}
                                        </span>
                                    )
                                }
                                i++
                            }

                            return elements
                        })()}
                    </div>
                </div>
            </div>
        </div>
    )
}