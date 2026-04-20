import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const url = new URL(req.url)
  const qRaw = url.searchParams.get('q') ?? ''
  if (qRaw.length < 2 || qRaw.length > 32) {
    return NextResponse.json({ results: [] })
  }
  // T-05-20: escape ilike wildcards so `%` / `_` cannot be smuggled in via q.
  const q = qRaw.replace(/[%_]/g, '\\$&')

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', `${q}%`)
    .neq('id', user.id) // exclude self (D-04 alignment)
    .limit(5)

  if (error) {
    console.error('[users/search] failed', error.message)
    return NextResponse.json({ results: [] })
  }
  return NextResponse.json({ results: data ?? [] })
}
