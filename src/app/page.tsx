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
    images: [{ url: 'https://wikifinder.vercel.app/og-image.png', width: 1200, height: 630, alt: 'Wikifinder — Le jeu quotidien Wikipedia' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wikifinder — Le jeu quotidien Wikipedia',
    description: 'Devine l\'article Wikipedia du jour mot par mot !',
    images: ['https://wikifinder.vercel.app/og-image.png'],
  },
}

export default function Home() {
  return <LandingPage />
}
