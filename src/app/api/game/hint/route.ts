import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseJsonBody, UuidSchema, LangSchema } from '@/lib/validation'
import { normalize } from '@/lib/matching'

// Phase 10.3 P5 — POST /api/game/hint.
// Sibling to /api/game/guess. Kept deliberately off the <50ms reveal critical path
// (which is /api/game/guess) — hint is a user-initiated side-channel event.
//
// Behavior (D-03 locked):
// 1. Validate body (gameId, pageId, lang) via zod.
// 2. Parallel auth + page load (Promise.all — mirrors guess/route.ts).
// 3. Ownership + completed + 3-hint-cap checks.
// 4. Build "already revealed" set from the guesses table (same pattern as guess win check).
// 5. Filter body tokens: type==='word' && !isStopword && not in title && not already revealed.
// 6. Pick 1 at random.
// 7. Race-safe increment via .lt('hints_used', MAX_HINTS) WHERE clause.
// 8. Insert a 'guesses' row for the revealed word so subsequent /api/game/guess calls
//    treat it as already-revealed when computing win.
// 9. Return { revealedTokens: [{index, value}], hintsUsed } — flat shape, consumed by
//    client reveal pipeline unchanged.
//
// Scope limitation (RESEARCH Pitfall 3): the 500pt deduction is COSMETIC-ONLY in 10.3,
// computed client-side in ResultModal. The server does NOT modify score columns or flip
// games.completed. Server-side score persistence with hint penalties is deferred to a
// future ranked-scoring revisit.

const HintBodySchema = z.object({
  gameId: UuidSchema,
  pageId: UuidSchema,
  lang: LangSchema,
})

const MAX_HINTS = 3

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, HintBodySchema)
  if ('error' in parsed) return parsed.error
  const { gameId, pageId, lang } = parsed.data

  // Parallel auth + page load — mirrors guess/route.ts:40-56.
  const [user, pageResult] = await Promise.all([
    (async () => {
      const supabase = await createSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      return user
    })(),
    supabaseAdmin
      .from('pages')
      .select('tokens_fr, tokens_en, title_tokens_fr, title_tokens_en')
      .eq('id', pageId)
      .single(),
  ])

  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  if (!pageResult.data) {
    return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
  }

  // Ownership + state + cap checks — mirror guess/route.ts:83-103.
  const { data: game, error: gameErr } = await supabaseAdmin
    .from('games')
    .select('id, user_id, completed, hints_used')
    .eq('id', gameId)
    .single()
  if (gameErr || !game || game.user_id !== user.id) {
    return NextResponse.json({ error: 'Partie introuvable' }, { status: 403 })
  }
  if (game.completed) {
    return NextResponse.json({ error: 'Partie terminée' }, { status: 400 })
  }
  const currentHints = (game.hints_used as number | null) ?? 0
  if (currentHints >= MAX_HINTS) {
    return NextResponse.json({ error: "Limite d'indices atteinte" }, { status: 400 })
  }

  // Derive revealed word set from existing guesses — same pattern as guess/route.ts:184-189.
  const { data: guessRows } = await supabaseAdmin
    .from('guesses')
    .select('word')
    .eq('game_id', gameId)
  const revealedWords = new Set(
    (guessRows ?? []).map((g: { word: string }) => normalize(String(g.word)))
  )

  // Load tokens + title tokens for lang
  const tokens = (lang === 'fr' ? pageResult.data.tokens_fr : pageResult.data.tokens_en) as
    | Array<{ index: number; type: string; value: string; isStopword?: boolean }>
    | null
  const titleTokens = (lang === 'fr' ? pageResult.data.title_tokens_fr : pageResult.data.title_tokens_en) as
    | Array<{ value: string; isWord?: boolean; isStopword?: boolean }>
    | null

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
  }

  const titleValues = new Set(
    (titleTokens ?? []).map(t => normalize(String(t.value ?? '')))
  )

  // Filter eligible body tokens.
  const eligible = tokens.filter(t =>
    t.type === 'word'
    && !t.isStopword
    && !titleValues.has(normalize(String(t.value)))
    && !revealedWords.has(normalize(String(t.value)))
  )
  if (eligible.length === 0) {
    return NextResponse.json(
      { error: lang === 'fr' ? 'Aucun indice disponible' : 'No hints available' },
      { status: 400 }
    )
  }

  // Pick one at random — D-03 allows un-seeded random.
  const picked = eligible[Math.floor(Math.random() * eligible.length)]

  // Race-safe atomic increment: succeeds only if still under cap.
  const newHintsUsed = currentHints + 1
  const { error: updateErr } = await supabaseAdmin
    .from('games')
    .update({ hints_used: newHintsUsed })
    .eq('id', gameId)
    .lt('hints_used', MAX_HINTS)
  if (updateErr) {
    Sentry.captureException(updateErr, { tags: { context: 'api/game/hint' } })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  // Persist the revealed word as a guess row so subsequent /api/game/guess calls see
  // it when computing the "won" check. Non-fatal: wrap in try/catch + Sentry per the
  // guess-route convention (guess/route.ts:144-149).
  try {
    await supabaseAdmin.from('guesses').insert({
      game_id: gameId,
      word: String(picked.value),
    })
  } catch (insertErr) {
    Sentry.captureException(insertErr, { tags: { context: 'api/game/hint' } })
    // Continue — the reveal is already committed client-side via the response below.
  }

  return NextResponse.json({
    revealedTokens: [{ index: picked.index, value: String(picked.value) }],
    hintsUsed: newHintsUsed,
  })
}
