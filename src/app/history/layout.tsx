import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Historique — Wikifinder',
  description: 'Retrouve toutes tes parties passées sur Wikifinder.',
}

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return children
}
