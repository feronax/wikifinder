import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get('gameId')
  if (!gameId) return NextResponse.json({ guesses: [] })

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ guesses: [] })

  const { data: guesses } = await supabaseAdmin
    .from('guesses')
    .select('word')
    .eq('game_id', gameId)
    .order('guessed_at', { ascending: true })

  return NextResponse.json({ guesses: guesses?.map(g => g.word) || [] })
}