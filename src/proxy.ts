import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the auth token — IMPORTANT: ne rien mettre entre createServerClient et getUser
  await supabase.auth.getUser()

  // Phase 13 / Plan 06 — POL-05 flag-flip: the wf_new_design cookie-write
  // bridge was removed here. The new design is now the only render path;
  // the WF_NEW_DESIGN env var stays set in Vercel prod for the deploy
  // window (per D-13) but is no longer read by application code.

  // === wf_lang Accept-Language seed (D-06, D-06a) ===
  // Set ONCE on first visit per user; never overwrite an existing cookie.
  // Output narrowed to 'fr' | 'en' literals — header content never echoed (T-08-40/41).
  const existingLang = request.cookies.get('wf_lang')?.value;
  if (!existingLang) {
    const accept = (request.headers.get('accept-language') ?? '').toLowerCase();
    const first = accept.split(',')[0]?.trim() ?? '';
    const seeded: 'fr' | 'en' = first.startsWith('en') ? 'en' : 'fr';
    request.cookies.set('wf_lang', seeded);
    supabaseResponse.cookies.set({
      name: 'wf_lang',
      value: seeded,
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
    });
  }
  // === end wf_lang ===

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
