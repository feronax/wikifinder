import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Classement — Wikifinder',
  description: 'Découvre les meilleurs joueurs de Wikifinder. Classement quotidien et global.',
  openGraph: {
    title: 'Classement — Wikifinder',
    description: 'Découvre les meilleurs joueurs de Wikifinder.',
    url: 'https://wikifinder.vercel.app/leaderboard',
  },
}

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
