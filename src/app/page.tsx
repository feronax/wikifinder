import type { Metadata } from 'next'
import LandingPage from './landing'

export const metadata: Metadata = {
  title: 'Wikifinder — Le jeu quotidien Wikipedia',
  description: 'Chaque jour, un nouvel article Wikipedia à deviner mot par mot. Trouve le titre en un minimum de tentatives et défie tes amis !',
  openGraph: {
    title: 'Wikifinder — Le jeu quotidien Wikipedia',
    description: 'Chaque jour, un nouvel article Wikipedia à deviner mot par mot. Trouve le titre en un minimum de tentatives !',
    url: 'https://wikifinder.vercel.app',
    siteName: 'Wikifinder',
    type: 'website',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'Wikifinder' }],
  },
  twitter: {
    card: 'summary',
    title: 'Wikifinder — Le jeu quotidien Wikipedia',
    description: 'Devine l\'article Wikipedia du jour mot par mot !',
    images: ['/icon-512.png'],
  },
}

export default function Home() {
  return <LandingPage />
}
