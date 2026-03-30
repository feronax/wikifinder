import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mon profil — Wikifinder',
  description: 'Gère ton profil, tes statistiques et tes préférences sur Wikifinder.',
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
