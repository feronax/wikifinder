import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  }

  const { subscription } = await req.json()

  if (!subscription || !subscription.endpoint) {
    return NextResponse.json({ error: 'Subscription invalide' }, { status: 400 })
  }

  // Upsert: met à jour si l'endpoint existe déjà, sinon insère
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  }

  const { endpoint } = await req.json()

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint manquant' }, { status: 400 })
  }

  await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ success: true })
}
