import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import FeedbackButton from '@/components/FeedbackButton'
import ThemeProvider from '@/components/ThemeProvider'
import './globals.css'
import ScrollToTop from '@/components/ScrollToTop'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'

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
  themeColor: '#5C7A3E',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Wikifinder',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
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
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('theme');
            if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', t);
          })();
        ` }} />
      </head>
      <body className={`${dmSans.variable} ${dmSerif.variable}`}>
        <GoogleTagManager gtmId="GTM-M2QGSL7C" />
        <ThemeProvider>
          <>
            {children}
            <ScrollToTop />
            <FeedbackButton />
            <ServiceWorkerRegistrar />
          </>
        </ThemeProvider>
      </body>
    </html>
  )
}