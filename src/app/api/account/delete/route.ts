import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function DELETE() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  }

  const userId = user.id

  // Supprime toutes les données utilisateur
  await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId)
  await supabaseAdmin.from('feedbacks').delete().eq('user_id', userId)

  // Supprime les guesses liés aux parties du joueur
  const { data: games } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('user_id', userId)

  if (games && games.length > 0) {
    const gameIds = games.map(g => g.id)
    await supabaseAdmin.from('guesses').delete().in('game_id', gameIds)
  }

  await supabaseAdmin.from('games').delete().eq('user_id', userId)
  await supabaseAdmin.from('profiles').delete().eq('id', userId)

  // Supprime le compte auth
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
