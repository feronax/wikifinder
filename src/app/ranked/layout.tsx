import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mode classé — Wikifinder',
  description: 'Affronte des articles adaptés à ton rang. Gagne des points et monte en classement !',
  openGraph: {
    title: 'Mode classé — Wikifinder',
    description: 'Mode classé Wikifinder — articles adaptés à ton rang.',
    url: 'https://wikifinder.vercel.app/ranked',
  },
}

export default function RankedLayout({ children }: { children: React.ReactNode }) {
  return children
}
