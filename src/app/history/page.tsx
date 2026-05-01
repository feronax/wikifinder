'use client'
// Phase 13 / Plan 06 — POL-05 flag-flip: legacy purge complete. The new
// design is now the only render path.
import NewHistoryScreen from '@/components/screens/new/NewHistoryScreen'

export default function HistoryPage() {
  return <NewHistoryScreen lang="fr" />
}
