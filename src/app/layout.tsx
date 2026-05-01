import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { DM_Sans, DM_Serif_Display, Geist, Source_Serif_4 } from 'next/font/google'
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
  // maximumScale removed — disabling zoom violates WCAG 1.4.4 (Resize Text)
  // and was the only `meta-viewport` axe-core violation across all pages.
  // Users who need to pinch-zoom for legibility now can.
  // Browser chrome tint. Picks the minimal-amber bg when the new-design flag
  // is set; else stays on the legacy green for backwards compat.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
  ],
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const langCookie = cookieStore.get('wf_lang')?.value
  const lang: 'fr' | 'en' = langCookie === 'en' ? 'en' : 'fr'
  // Phase 13 / Plan 06 — POL-05 flag-flip: legacy purge complete. New design
  // is now the only render path; the `wf_new_design` cookie/env flag is
  // deprecated (env still set in Vercel prod for the deploy window per D-13;
  // harmless thereafter). The inline anti-FOUC theme-bootstrap script below
  // (TH-02) remains the source of truth for `data-theme` on first paint.
  return (
    <html
      lang={lang}
      suppressHydrationWarning
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
            <InstallBanner />
            <ServiceWorkerRegistrar />
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}