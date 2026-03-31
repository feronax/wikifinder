import type { Metadata, Viewport } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import FeedbackButton from '@/components/FeedbackButton'
import ThemeProvider from '@/components/ThemeProvider'
import './globals.css'
import ScrollToTop from '@/components/ScrollToTop'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import Footer from '@/components/Footer'
import ErrorBoundary from '@/components/ErrorBoundary'

// Import de Google Tag Manager
import { GoogleTagManager } from '@next/third-parties/google'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600'],
  display: 'swap',
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: '400',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Wikifinder',
  description: 'Trouve la page Wikipédia du jour',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Wikifinder',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#5C7A3E',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="canonical" href="https://wikifinder.vercel.app" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Wikifinder',
            url: 'https://wikifinder.vercel.app',
            description: 'Jeu quotidien de devinettes basé sur des articles Wikipedia. Devine le titre mot par mot !',
            applicationCategory: 'GameApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
            image: 'https://wikifinder.vercel.app/og-image.png',
            author: { '@type': 'Person', name: 'Feronax' },
            inLanguage: ['fr', 'en'],
          }) }}
        />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('theme');
            if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', t);
          })();
        ` }} />
      </head>
      <body className={`${dmSans.variable} ${dmSerif.variable}`} suppressHydrationWarning>
        <GoogleTagManager gtmId="GTM-M2QGSL7C" />
        <ThemeProvider>
          <ErrorBoundary>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              <div style={{ flex: 1 }}>
                {children}
              </div>
              <Footer />
            </div>
          </ErrorBoundary>
          <ScrollToTop />
          <FeedbackButton />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  )
}