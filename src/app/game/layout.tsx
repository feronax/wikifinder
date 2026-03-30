import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Jouer — Wikifinder',
  description: 'Devine l\'article Wikipedia du jour mot par mot. Un nouveau défi chaque jour !',
  openGraph: {
    title: 'Jouer — Wikifinder',
    description: 'Devine l\'article Wikipedia du jour mot par mot.',
    url: 'https://wikifinder.vercel.app/game',
  },
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return children
}
