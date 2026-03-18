import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  }

  // Récupère toutes les pages disponibles
  const { data: pages, error: pagesError } = await supabaseAdmin
    .from('pages')
    .select('id, date, wikipedia_title_fr, wikipedia_title_en')
    .order('date', { ascending: false })

  if (pagesError) {
    return NextResponse.json({ error: pagesError.message }, { status: 500 })
  }

  // Récupère les parties du joueur (une seule par page — la plus récente)
  const { data: games, error: gamesError } = await supabaseAdmin
    .from('games')
    .select('id, page_id, lang, guess_count, completed, completed_at')
    .eq('user_id', user.id)

  if (gamesError) {
    return NextResponse.json({ error: gamesError.message }, { status: 500 })
  }

  // Pour chaque page, trouve la meilleure partie du joueur (complétée en priorité)
  const history = pages.map(page => {
    const pageGames = games.filter(g => g.page_id === page.id)
    const completedGame = pageGames.find(g => g.completed)
    const bestGame = completedGame || pageGames[0] || null

    return {
      page_id: page.id,
      date: page.date,
      wikipedia_title_fr: page.wikipedia_title_fr,
      wikipedia_title_en: page.wikipedia_title_en,
      game: bestGame,
    }
  })

  return NextResponse.json({ history })
}