import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('games')
    .select(`
      id, lang, guess_count, completed, completed_at,
      pages ( date, wikipedia_title_fr, wikipedia_title_en )
    `)
    .eq('user_id', user.id)
.order('started_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ games: data || [] })
}