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

  const { data: feedback, error } = await supabaseAdmin
    .from('feedbacks')
    .insert({
      user_id: user.id,
      page_id: pageId || null,
      type: 'autre',
      message: message.trim(),
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Échappe le HTML pour éviter les injections XSS dans l'email
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const safeEmail = escapeHtml(user.email || '')
  const safeMessage = escapeHtml(message.trim()).replace(/\n/g, '<br>')
  const safePageId = pageId ? escapeHtml(String(pageId)) : ''

  await resend.emails.send({
    from: 'Wikifinder <onboarding@resend.dev>',
    to: process.env.FEEDBACK_EMAIL!,
    subject: '💬 Nouveau feedback Wikifinder',
    html: `
      <h2>Nouveau feedback reçu</h2>
      <p><strong>Utilisateur :</strong> ${safeEmail}</p>
      <p><strong>Message :</strong></p>
      <blockquote style="border-left: 3px solid #00ADB5; padding-left: 12px; color: #444;">
        ${safeMessage}
      </blockquote>
      ${safePageId ? `<p><strong>Page ID :</strong> ${safePageId}</p>` : ''}
    `
  })

  return NextResponse.json({ success: true, feedbackId: feedback?.id })
}