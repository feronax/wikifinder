import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseSearchParams } from '@/lib/validation'

const PAGE_SIZE = 20

const HistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(1000).optional().default(1),
})

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  }

  const parsed = parseSearchParams(new URL(req.url), HistoryQuerySchema)
  if ('error' in parsed) return parsed.error
  const page = parsed.data.page
  const offset = (page - 1) * PAGE_SIZE

  // Compte le total de pages disponibles
  const { count: totalCount } = await supabaseAdmin
    .from('pages')
    .select('*', { count: 'exact', head: true })

  // Récupère les pages paginées
  const { data: pages, error: pagesError } = await supabaseAdmin
    .from('pages')
    .select('id, date, wikipedia_title_fr, wikipedia_title_en')
    .order('date', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (pagesError) {
    return NextResponse.json({ error: pagesError.message }, { status: 500 })
  }

  const pageIds = pages.map(p => p.id)

  // Récupère uniquement les parties du joueur pour ces pages
  const { data: games, error: gamesError } = await supabaseAdmin
    .from('games')
    .select('id, page_id, lang, guess_count, completed, completed_at')
    .eq('user_id', user.id)
    .in('page_id', pageIds)

  if (gamesError) {
    return NextResponse.json({ error: gamesError.message }, { status: 500 })
  }

  const history = pages.map(page => {
    const pageGames = (games || []).filter(g => g.page_id === page.id)
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

  return NextResponse.json({
    history,
    page,
    totalPages: Math.ceil((totalCount || 0) / PAGE_SIZE),
    total: totalCount || 0,
  })
}
