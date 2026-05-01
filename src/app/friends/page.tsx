'use client'
// Phase 13 / Plan 06 — POL-05 flag-flip: legacy purge complete. The new
// design is now the only render path; LegacyFriendsScreen.tsx is removed.
import NewFriendsScreen from '@/components/screens/new/NewFriendsScreen'

export default function FriendsPage() {
  return <NewFriendsScreen lang="fr" />
}
