import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { FollowSchema, UnfollowSchema } from '@/lib/validation'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = FollowSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }
  const { followeeId } = parsed.data

  // D-04: API-level self-follow guard (defense-in-depth with DB CHECK)
  if (followeeId === user.id) {
    return NextResponse.json({ error: 'Tu ne peux pas te suivre toi-même' }, { status: 400 })
  }

  const { error } = await supabase
    .from('follows')
    .upsert(
      { follower_id: user.id, followee_id: followeeId },
      { onConflict: 'follower_id,followee_id', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[follows] upsert failed', error.message)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = UnfollowSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }
  const { followeeId } = parsed.data

  // D-05: idempotent — 200 even when no row matched
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('followee_id', followeeId)

  if (error) {
    console.error('[follows] delete failed', error.message)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
