import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createHash } from 'crypto'

export async function POST(req: NextRequest) {
  const { lang, pageId } = await req.json()

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ saved: false })

  // Calcule le hash IP + navigateur
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const userAgent = req.headers.get('user-agent') || 'unknown'
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
  const browserHash = createHash('sha256').update(userAgent).digest('hex').slice(0, 16)

  // Vérifie si une partie existe déjà
  const { data: existing } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('user_id', user.id)
    .eq('page_id', pageId)
    .eq('lang', lang)
    .single()

  if (existing) return NextResponse.json({ saved: true, game: existing })

  // Détecte si d'autres comptes ont joué avec le même hash aujourd'hui
  const { data: sameIpGames } = await supabaseAdmin
    .from('games')
    .select('user_id')
    .eq('ip_hash', ipHash)
    .eq('page_id', pageId)
    .neq('user_id', user.id)

  const isFlagged = (sameIpGames?.length || 0) > 0

  const { data: game, error } = await supabaseAdmin
    .from('games')
    .insert({
      user_id: user.id,
      page_id: pageId,
      lang,
      guess_count: 0,
      completed: false,
      ip_hash: ipHash,
      browser_hash: browserHash,
      is_flagged: isFlagged,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ saved: true, game })
}