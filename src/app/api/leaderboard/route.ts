import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') || 'daily'
  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0]

  if (type === 'daily') {
    const { data, error } = await supabaseAdmin
      .from('leaderboard_daily')
      .select('*')
      .eq('date', date)
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ leaderboard: data || [] })
  }

  if (type === 'global') {
    const { data, error } = await supabaseAdmin
      .from('leaderboard_global')
      .select('*')
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ leaderboard: data || [] })
  }

  return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
}