import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BADGES, BADGE_MAP } from '@/lib/badges'
import { parseSearchParams, UuidSchema } from '@/lib/validation'

const BadgesQuerySchema = z.object({ userId: UuidSchema })

export async function GET(req: NextRequest) {
  const parsed = parseSearchParams(new URL(req.url), BadgesQuerySchema)
  if ('error' in parsed) return parsed.error
  const { userId } = parsed.data

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
