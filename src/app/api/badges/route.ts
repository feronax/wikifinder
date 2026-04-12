import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BADGES, BADGE_MAP } from '@/lib/badges'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId requis' }, { status: 400 })
  }

  const { data: userBadges } = await supabaseAdmin
    .from('badges')
    .select('badge_key, unlocked_at')
    .eq('user_id', userId)

  const owned = new Map((userBadges || []).map((b: any) => [b.badge_key, b.unlocked_at]))

  const badges = BADGES.map(b => ({
    ...b,
    unlocked: owned.has(b.key),
    unlockedAt: owned.get(b.key) || null,
  }))

  return NextResponse.json({ badges })
}
