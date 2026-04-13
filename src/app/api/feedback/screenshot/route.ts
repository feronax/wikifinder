import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  }

  const { screenshot, feedbackId } = await req.json()

  if (!screenshot || !feedbackId) {
    return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
  }

  // Decode base64 et upload dans Supabase Storage
  const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')
  const filename = `feedback-${feedbackId}-${Date.now()}.png`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('screenshots')
    .upload(filename, buffer, {
      contentType: 'image/png',
      upsert: false,
    })

  if (uploadError) {
    // Si le bucket n'existe pas, on le crée
    if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
      await supabaseAdmin.storage.createBucket('screenshots', { public: true })
      const { error: retryError } = await supabaseAdmin.storage
        .from('screenshots')
        .upload(filename, buffer, { contentType: 'image/png' })
      if (retryError) {
        return NextResponse.json({ error: retryError.message }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }
  }

  // Récupère l'URL publique
  const { data: urlData } = supabaseAdmin.storage
    .from('screenshots')
    .getPublicUrl(filename)

  // Met à jour le feedback avec l'URL du screenshot
  await supabaseAdmin
    .from('feedbacks')
    .update({ screenshot_url: urlData.publicUrl })
    .eq('id', feedbackId)

  return NextResponse.json({ success: true, url: urlData.publicUrl })
}
