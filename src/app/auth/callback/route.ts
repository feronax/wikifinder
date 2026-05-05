import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const lang = searchParams.get('lang')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Bug 4 fix: persist lang preference to profiles.preferences on account
      // creation / first login so the game page honours the user's language on
      // every subsequent visit without requiring a URL param.
      const validLang = lang === 'en' || lang === 'fr' ? lang : null
      if (validLang && sessionData?.user?.id) {
        // Read-modify-write to preserve any sibling preference keys (mode, etc.)
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', sessionData.user.id)
          .maybeSingle()
        const existing = (profile as { preferences?: Record<string, unknown> } | null)?.preferences ?? {}
        await supabase
          .from('profiles')
          .update({ preferences: { ...existing, lang: validLang } })
          .eq('id', sessionData.user.id)
      }

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
