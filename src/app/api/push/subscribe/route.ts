import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseJsonBody } from '@/lib/validation'

const SubscribeBodySchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(500),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }).passthrough(),
  }),
})

const UnsubscribeBodySchema = z.object({
  endpoint: z.string().url().max(500),
})

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  }

  const parsed = await parseJsonBody(req, SubscribeBodySchema)
  if ('error' in parsed) return parsed.error
  const { subscription } = parsed.data

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

  const parsed = await parseJsonBody(req, UnsubscribeBodySchema)
  if ('error' in parsed) return parsed.error
  const { endpoint } = parsed.data

  await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ success: true })
}
