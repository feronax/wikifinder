import { isStopword } from '@/lib/wikipedia'

export type ContentToken = {
    index: number
    type: 'word' | 'space' | 'punct'
    value: string
    isStopword: boolean
    isHeading?: boolean
    headingLevel?: number
    length?: number
}

export type TitleToken = {
    index: number
    value: string
    isStopword: boolean
    isWord: boolean
    length: number
}

export function tokenizeContent(content: string, lang: 'fr' | 'en'): ContentToken[] {
    const lines = content.split('\n')
    const tokens: ContentToken[] = []
    let tokenIndex = 0

    for (const line of lines) {
        const headingMatch = line.match(/^(={2,6})\s*(.+?)\s*\1$/)
        if (headingMatch) {
            const level = headingMatch[1].length
            const text = headingMatch[2]
            const lineTokens = text.split(/([ \t]+|[-',.()«»"!?;:])/).filter(Boolean)

            for (const t of lineTokens) {
                if (/^[ \t]+$/.test(t)) {
                    tokens.push({ index: tokenIndex++, type: 'space', value: t, isStopword: false })
                } else if (/^[a-zA-ZÀ-ÿ0-9]+$/.test(t)) {
                    const isStop = isStopword(t, lang)
                    tokens.push({
                        index: tokenIndex++,
                        type: 'word',
                        value: t,
                        isStopword: isStop,
                        isHeading: true,
                        headingLevel: level,
                        length: t.length,
                    })
                } else {
                    tokens.push({ index: tokenIndex++, type: 'punct', value: t, isStopword: false })
                }
            }
            tokens.push({ index: tokenIndex++, type: 'space', value: '\n', isStopword: false })
            continue
        }

        const lineTokens = line.split(/([ \t]+|[-',.()«»"!?;:])/).filter(Boolean)
        for (const t of lineTokens) {
            if (/^[ \t]+$/.test(t)) {
                tokens.push({ index: tokenIndex++, type: 'space', value: t, isStopword: false })
            } else if (/[a-zA-ZÀ-ÿ0-9]/.test(t)) {
                const isStop = isStopword(t, lang)
                tokens.push({
                    index: tokenIndex++,
                    type: 'word',
                    value: t,
                    isStopword: isStop,
                    length: t.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '').length,
                })
            } else {
                tokens.push({ index: tokenIndex++, type: 'punct', value: t, isStopword: false })
            }
        }
        tokens.push({ index: tokenIndex++, type: 'space', value: '\n', isStopword: false })
    }

    return tokens
}

export function tokenizeTitle(title: string, lang: 'fr' | 'en'): TitleToken[] {
    return title.split(/(\s+|[-',.()])/).filter(Boolean).map((t, i) => {
        const isWord = /[a-zA-ZÀ-ÿ0-9]/.test(t)
        const isStop = isWord ? isStopword(t, lang) : true
        return {
            index: i,
            value: t,
            isStopword: isStop,
            isWord,
            length: isWord ? t.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '').length : 0,
        }
    })
}

/** Strip hidden word values for client — returns safe tokens */
export function maskTokensForClient(tokens: ContentToken[]) {
    return tokens.map(t => ({
        ...t,
        value: (t.type === 'word' && !t.isStopword) ? '' : t.value,
        visible: t.type !== 'word' || t.isStopword,
    }))
}

/** Strip hidden title word values for client */
export function maskTitleForClient(titleTokens: TitleToken[]) {
    return titleTokens.map(tw => {
        const revealed = !tw.isWord || tw.isStopword
        return {
            index: tw.index,
            value: revealed ? tw.value : '',
            isStopword: tw.isStopword,
            revealed,
            length: tw.length,
        }
    })
}
