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

  // === WF_NEW_DESIGN flag bridge (D-09, D-10, D-11, D-11a) ===
  // Derive target value: query-param override wins (for dev/staging), else env.
  const envFlag: '0' | '1' = process.env.WF_NEW_DESIGN === '1' ? '1' : '0'
  const queryOverride = request.nextUrl.searchParams.get('wf_new_design')
  const target: '0' | '1' = queryOverride === '0' || queryOverride === '1' ? queryOverride : envFlag
  const existing = request.cookies.get('wf_new_design')?.value

  if (existing !== target) {
    // Same-request visibility (Q1/A5): downstream server components calling
    // cookies() from 'next/headers' see `target` on this request, not the stale value.
    request.cookies.set('wf_new_design', target)
    // Browser persistence.
    supabaseResponse.cookies.set({
      name: 'wf_new_design',
      value: target,
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
    })
  }
  // === end WF_NEW_DESIGN ===

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
