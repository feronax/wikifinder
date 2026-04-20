import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { User } from '@supabase/supabase-js'

type RequireAdminResult =
  | { user: User }
  | { error: NextResponse }

/**
 * Auth gate for /api/admin/* routes.
 *
 * Single-path RBAC (v1.0.1): relies entirely on app_metadata.role === 'admin'
 * on the server-validated user. The legacy password-header dual-auth window
 * (Phase 1 D-05) is closed; role SQL is live in production.
 *
 * `_req` is kept in the signature for caller-side API stability; it is not read.
 */
export async function requireAdmin(_req: NextRequest): Promise<RequireAdminResult> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && user.app_metadata?.role === 'admin') {
    return { user }
  }
  return {
    error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }),
  }
}
