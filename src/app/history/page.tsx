'use client'
// Phase 11 / D-10 — thin flag-gate shim. Legacy body extracted byte-identical
// to ./LegacyHistoryScreen.tsx. Plan 09 will add the isNew ? New : Legacy branch.
import LegacyHistoryScreen from './LegacyHistoryScreen'

export default function HistoryPage() {
  return <LegacyHistoryScreen />
}
