'use client'
// Phase 11 / D-10 — flag-gate branch. Legacy body preserved byte-identical in ./LegacyFriendsScreen.tsx.
import { useNewDesignFlag } from '@/lib/feature-flags-client'
import NewFriendsScreen from '@/components/screens/new/NewFriendsScreen'
import LegacyFriendsScreen from './LegacyFriendsScreen'

export default function FriendsPage() {
  const isNew = useNewDesignFlag()
  if (!isNew) return <LegacyFriendsScreen />
  return <NewFriendsScreen lang="fr" />
}
