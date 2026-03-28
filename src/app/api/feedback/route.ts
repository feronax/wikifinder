import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { message, pageId } = await req.json()

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message vide' }, { status: 400 })
  }

  if (message.trim().length < 30) {
    return NextResponse.json({ error: 'Message trop court (30 caractères minimum)' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('feedbacks')
    .insert({
      user_id: user.id,
      page_id: pageId || null,
      type: 'autre',
      message: message.trim(),
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await resend.emails.send({
    from: 'Wikifinder <onboarding@resend.dev>',
    to: process.env.FEEDBACK_EMAIL!,
    subject: '💬 Nouveau feedback Wikifinder',
    html: `
      <h2>Nouveau feedback reçu</h2>
      <p><strong>Utilisateur :</strong> ${user.email}</p>
      <p><strong>Message :</strong></p>
      <blockquote style="border-left: 3px solid #00ADB5; padding-left: 12px; color: #444;">
        ${message.trim().replace(/\n/g, '<br>')}
      </blockquote>
      ${pageId ? `<p><strong>Page ID :</strong> ${pageId}</p>` : ''}
    `
  })

  return NextResponse.json({ success: true })
}