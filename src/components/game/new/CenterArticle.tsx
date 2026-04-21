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
}: CenterArticleProps) {
    return (
        <div style={{ minWidth: 0 }}>
            <TitleHero
                titleWords={titleWords}
                pageId={pageId}
                lang={lang}
                attemptsCount={attemptsCount}
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
