import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import FeedbackButton from '@/components/FeedbackButton'
import ThemeProvider from '@/components/ThemeProvider'
import './globals.css'
import ScrollToTop from '@/components/ScrollToTop'

// Import de Google Tag Manager
import { GoogleTagManager } from '@next/third-parties/google'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600'],
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: '400',
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Wikifinder',
  description: 'Trouve la page Wikipédia du jour',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${dmSerif.variable}`}>
        <ThemeProvider>
          <>
            {children}
            <ScrollToTop />
            <FeedbackButton />
          </>
        </ThemeProvider>
      </body>
      {/* Ajout du composant GTM ici avec ton ID */}
      <GoogleTagManager gtmId="GTM-M2QGSL7C" />
    </html>
  )
}