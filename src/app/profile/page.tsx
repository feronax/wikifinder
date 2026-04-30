'use client'
// Phase 11 / D-10 — flag-gate branch. Legacy body preserved byte-identical in ./LegacyProfileScreen.tsx.
import { useNewDesignFlag } from '@/lib/feature-flags-client'
import NewProfileScreen from '@/components/screens/new/NewProfileScreen'
import LegacyProfileScreen from './LegacyProfileScreen'

export default function ProfilePage() {
  const isNew = useNewDesignFlag()
  if (!isNew) return <LegacyProfileScreen />
  return <NewProfileScreen lang="fr" />
}
