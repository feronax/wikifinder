import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const lastGuessTime = new Map<string, number>()
const MIN_DELAY_MS = 200

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ saved: false })

  // Vérifie le délai minimum entre deux guesses
  const now = Date.now()
  const last = lastGuessTime.get(user.id) || 0
  if (now - last < MIN_DELAY_MS) {
    return NextResponse.json({ error: 'Trop rapide' }, { status: 429 })
  }
  lastGuessTime.set(user.id, now)

  // Nettoyage périodique de la map
  if (lastGuessTime.size > 10000) {
    for (const [k, t] of lastGuessTime.entries()) {
      if (now - t > 60000) lastGuessTime.delete(k)
    }
  }

  const { gameId, word, guessCount, completed, completedAt, durationSeconds } = await req.json()

  if (!gameId) return NextResponse.json({ saved: false })

  // Enregistre la tentative
  await supabaseAdmin.from('guesses').insert({ game_id: gameId, word })

  // Met à jour la partie
  const updateData: any = { guess_count: guessCount }
  if (completed) {
    updateData.completed = true
    updateData.completed_at = completedAt
    updateData.duration_seconds = durationSeconds
  }

  await supabaseAdmin.from('games').update(updateData).eq('id', gameId)

  return NextResponse.json({ saved: true })
}