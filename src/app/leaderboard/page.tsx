'use client'
// Phase 11 / D-10 — thin flag-gate shim. Legacy body extracted byte-identical
// to ./LegacyLeaderboardScreen.tsx. Plan 09 will add the isNew ? New : Legacy branch.
import LegacyLeaderboardScreen from './LegacyLeaderboardScreen'

export default function LeaderboardPage() {
  return <LegacyLeaderboardScreen />
}
