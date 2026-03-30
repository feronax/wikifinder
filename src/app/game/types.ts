export type Token = {
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

export type TitleWord = {
    index: number
    value: string
    isStopword: boolean
    revealed: boolean
    length: number
}

export type Guess = {
    word: string
    found: boolean
}

export type GameState = {
    tokens: Token[]
    titleWords: TitleWord[]
    guesses: Guess[]
    guessCount: number
    won: boolean
    pageData: any
    gameId: string | null
}

export const translations = {
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
