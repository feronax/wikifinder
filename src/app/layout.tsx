import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { DM_Sans, DM_Serif_Display, Geist, Source_Serif_4 } from 'next/font/google'
import FeedbackButton from '@/components/FeedbackButton'
import ThemeProvider from '@/components/ThemeProvider'
import LangProvider from '@/components/LangProvider'
import './globals.css'
import './design-tokens.generated.css'
import ScrollToTop from '@/components/ScrollToTop'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import Footer from '@/components/Footer'
import ErrorBoundary from '@/components/ErrorBoundary'
import InstallBanner from '@/components/InstallBanner'

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

const geist = Geist({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-geist',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: true,
})

const sourceSerif4 = Source_Serif_4({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-source-serif-4',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: true,
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const langCookie = cookieStore.get('wf_lang')?.value
  const lang: 'fr' | 'en' = langCookie === 'en' ? 'en' : 'fr'
  // Propagate WF_NEW_DESIGN flag to <html> so globals.css can swap the legacy
  // palette to the minimal-amber --wf-* tokens on EVERY page, not just /game.
  const newDesignOn = cookieStore.get('wf_new_design')?.value === '1'
  return (
    <html
      lang={lang}
      suppressHydrationWarning
      {...(newDesignOn ? { 'data-wf-new-design': '1' } : {})}
    >
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="canonical" href="https://wikifinder.vercel.app" />
        <link rel="alternate" hrefLang="fr" href="https://wikifinder.vercel.app/game?lang=fr" />
        <link rel="alternate" hrefLang="en" href="https://wikifinder.vercel.app/game?lang=en" />
        <link rel="alternate" hrefLang="x-default" href="https://wikifinder.vercel.app" />
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
      <body className={`${dmSans.variable} ${dmSerif.variable} ${geist.variable} ${sourceSerif4.variable}`} suppressHydrationWarning>
        <GoogleTagManager gtmId="GTM-M2QGSL7C" />
        <ThemeProvider>
          <LangProvider initialLang={lang}>
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
            <InstallBanner />
            <ServiceWorkerRegistrar />
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}