'use client'
// Phase 11 / D-10 — flag-gate branch. Legacy body preserved byte-identical in ./LegacyHistoryScreen.tsx.
import { useNewDesignFlag } from '@/lib/feature-flags-client'
import NewHistoryScreen from '@/components/screens/new/NewHistoryScreen'
import LegacyHistoryScreen from './LegacyHistoryScreen'

export default function HistoryPage() {
  const isNew = useNewDesignFlag()
  if (!isNew) return <LegacyHistoryScreen />
  return <NewHistoryScreen lang="fr" />
}
