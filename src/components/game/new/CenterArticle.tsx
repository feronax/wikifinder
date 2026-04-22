'use client'

import React from 'react'
import TitleHero from '@/components/game/new/TitleHero'
import ArticleBody from '@/components/game/new/ArticleBody'
import type { Token, TitleWord } from '@/app/game/types'

interface CenterArticleProps {
    tokens: Token[]
    titleWords: TitleWord[]
    pageId: string
    foundSet: Set<string>
    justRevealedWord: string | null
    highlightedWord: string | null
    lang: 'fr' | 'en'
    attemptsCount: number
    // Phase 10.3 P4 — threaded down into the nested TitleHero so the
    // "Voir le résultat" banner can open the desktop ResultModal.
    onOpenResult?: () => void
}

export default function CenterArticle({
    tokens,
    titleWords,
    pageId,
    foundSet,
    justRevealedWord,
    highlightedWord,
    lang,
    attemptsCount,
    onOpenResult,
}: CenterArticleProps) {
    return (
        <div style={{ minWidth: 0 }}>
            <TitleHero
                titleWords={titleWords}
                pageId={pageId}
                lang={lang}
                attemptsCount={attemptsCount}
                onOpenResult={onOpenResult}
            />
            <ArticleBody
                tokens={tokens}
                pageId={pageId}
                foundSet={foundSet}
                justRevealedWord={justRevealedWord}
                highlightedWord={highlightedWord}
                lang={lang}
            />
        </div>
    )
}
