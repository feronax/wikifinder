import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:guillyan.chapput@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: subscriptions } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, keys')

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Aucune souscription' })
  }

  const payload = JSON.stringify({
    title: 'Wikifinder',
    body: 'La partie du jour est disponible ! Viens jouer 🎮',
    url: '/game',
  })

  let sent = 0
  let failed = 0
  const toDelete: string[] = []

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      )
      sent++
    } catch (err: any) {
      failed++
      if (err.statusCode === 410 || err.statusCode === 404) {
        toDelete.push(sub.id)
      }
    }
  }

  if (toDelete.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .in('id', toDelete)
  }

  return NextResponse.json({ sent, failed, cleaned: toDelete.length })
}
