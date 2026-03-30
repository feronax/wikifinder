import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Appelle l'endpoint push/send avec le même secret
  const baseUrl = req.nextUrl.origin
  const res = await fetch(`${baseUrl}/api/push/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({
      title: 'Wikifinder',
      body: 'La partie du jour est disponible ! Viens jouer 🎮',
    }),
  })

  const data = await res.json()
  return NextResponse.json(data)
}
