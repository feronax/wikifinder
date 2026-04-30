'use client'
// Phase 11 / D-10 — flag-gate branch. Legacy body preserved byte-identical in ./LegacyLeaderboardScreen.tsx.
import { useNewDesignFlag } from '@/lib/feature-flags-client'
import NewLeaderboardScreen from '@/components/screens/new/NewLeaderboardScreen'
import LegacyLeaderboardScreen from './LegacyLeaderboardScreen'

export default function LeaderboardPage() {
  const isNew = useNewDesignFlag()
  if (!isNew) return <LegacyLeaderboardScreen />
  return <NewLeaderboardScreen lang="fr" />
}
