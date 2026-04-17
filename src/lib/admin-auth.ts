import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { User } from '@supabase/supabase-js'

type RequireAdminResult =
  | { user: User }
  | { error: NextResponse }

/**
 * Auth gate for /api/admin/* routes.
 *
 * Dual-auth window (per CONTEXT.md D-05): accepts EITHER
 *  (a) app_metadata.role === 'admin' on the server-validated user, OR
 *  (b) x-admin-password === ADMIN_PASSWORD env (legacy fallback)
 *
 * When (b) succeeds but (a) is missing for an authenticated user, force a
 * session refresh (D-08). After PR2 ships and the role is verified live, a
 * tiny follow-up PR removes the (b) branch.
 *
 * Mirrors the `parseJsonBody` discriminated-union pattern from validation.ts.
 *
 * Usage:
 *   const auth = await requireAdmin(req)
 *   if ('error' in auth) return auth.error
 *   // auth.user is the authenticated admin
 */
export async function requireAdmin(req: NextRequest): Promise<RequireAdminResult> {
  const supabase = await createSupabaseServerClient()

  // Path A: signed-in user with role claim (preferred — server-validates JWT)
  const { data: { user } } = await supabase.auth.getUser()
  if (user && user.app_metadata?.role === 'admin') {
    return { user }
  }

  // Path B: legacy password header (LEGACY — remove in follow-up PR after live verification)
  const adminPassword = req.headers.get('x-admin-password')
  if (adminPassword && adminPassword === process.env.ADMIN_PASSWORD) {
    // D-08 JWT staleness trap: if a user is signed in but their JWT lacks the role
    // claim (e.g., they signed in BEFORE the SQL UPDATE provisioned the role),
    // force-refresh their session so subsequent requests use Path A.
    if (user && !user.app_metadata?.role) {
      await supabase.auth.refreshSession()
    }
    // Synthesize a "user" return for legacy callers that don't have a session.
    // After PR2's follow-up PR, this branch is deleted entirely.
    return {
      user: user ?? ({
        id: 'legacy-admin',
        email: null,
        app_metadata: { role: 'admin' },
      } as unknown as User),
    }
  }

  return {
    error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }),
  }
}
