'use client'
// Phase 11 / D-10 — thin flag-gate shim. Legacy body extracted byte-identical
// to ./LegacyProfileScreen.tsx. Plan 09 will add the isNew ? New : Legacy branch.
import LegacyProfileScreen from './LegacyProfileScreen'

export default function ProfilePage() {
  return <LegacyProfileScreen />
}
