'use client'
// Phase 11 / D-10 — flag-gate branch. Legacy body preserved byte-identical in ./LegacyRankedScreen.tsx.
import { useNewDesignFlag } from '@/lib/feature-flags-client'
import NewRankedScreen from '@/components/screens/new/NewRankedScreen'
import LegacyRankedScreen from './LegacyRankedScreen'

export default function RankedPage() {
  const isNew = useNewDesignFlag()
  if (!isNew) return <LegacyRankedScreen />
  return <NewRankedScreen lang="fr" />
}
