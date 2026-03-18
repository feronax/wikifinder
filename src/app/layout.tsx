import FeedbackButton from '@/components/FeedbackButton'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>
        {children}
        <FeedbackButton />
      </body>
    </html>
  )
}