import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const lang = searchParams.get('lang')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Build redirect target: prefer ?next=, fall back to /game
      const base = (next && next.startsWith('/')) ? next : '/game'
      // Append ?lang= only when valid and not already in base
      const langParam = (lang === 'en' || lang === 'fr') && !base.includes('lang=')
        ? (base.includes('?') ? `&lang=${lang}` : `?lang=${lang}`)
        : ''
      return NextResponse.redirect(`${origin}${base}${langParam}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
