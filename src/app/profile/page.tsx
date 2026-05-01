'use client'
// Phase 13 / Plan 06 — POL-05 flag-flip: legacy purge complete. The new
// design is now the only render path.
import NewProfileScreen from '@/components/screens/new/NewProfileScreen'

export default function ProfilePage() {
  return <NewProfileScreen lang="fr" />
}
