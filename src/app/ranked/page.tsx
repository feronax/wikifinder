'use client'
// Phase 13 / Plan 06 — POL-05 flag-flip: legacy purge complete. The new
// design is now the only render path; LegacyRankedScreen.tsx is removed.
import NewRankedScreen from '@/components/screens/new/NewRankedScreen'

export default function RankedPage() {
  return <NewRankedScreen lang="fr" />
}
