'use client'
// Phase 11 / D-10 — thin flag-gate shim. Legacy body extracted byte-identical
// to ./LegacyRankedScreen.tsx. Plan 09 will add the isNew ? New : Legacy branch.
import LegacyRankedScreen from './LegacyRankedScreen'

export default function RankedPage() {
  return <LegacyRankedScreen />
}
