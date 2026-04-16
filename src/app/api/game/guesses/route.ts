import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseSearchParams, UuidSchema } from '@/lib/validation'

const GuessesQuerySchema = z.object({ gameId: UuidSchema.optional() })

export async function GET(req: NextRequest) {
  const parsed = parseSearchParams(new URL(req.url), GuessesQuerySchema)
  if ('error' in parsed) return parsed.error
  const gameId = parsed.data.gameId
  if (!gameId) return NextResponse.json({ guesses: [] })

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ guesses: [] })

  // Vérifie que la partie appartient à l'utilisateur
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('user_id')
    .eq('id', gameId)
    .single()

  if (!game || game.user_id !== user.id) {
    return NextResponse.json({ guesses: [] })
  }

  const { data: guesses } = await supabaseAdmin
    .from('guesses')
    .select('word')
    .eq('game_id', gameId)
    .order('guessed_at', { ascending: true })

  return NextResponse.json({ guesses: guesses?.map(g => g.word) || [] })
}