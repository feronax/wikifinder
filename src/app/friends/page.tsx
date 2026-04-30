'use client'
// Phase 11 / D-10 — thin flag-gate shim. Legacy body extracted byte-identical
// to ./LegacyFriendsScreen.tsx. Plan 09 will add the isNew ? New : Legacy branch.
import LegacyFriendsScreen from './LegacyFriendsScreen'

export default function FriendsPage() {
  return <LegacyFriendsScreen />
}
