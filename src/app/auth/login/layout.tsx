import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion — Wikifinder',
  description: 'Connecte-toi ou crée un compte pour sauvegarder ta progression, tes streaks et ton classement.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
