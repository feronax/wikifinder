import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { maskTokensForClient, maskTitleForClient } from '@/lib/tokenize'
import { parseJsonBody, SurvivalStartSchema } from '@/lib/validation'
import { acquireIdempotencySlot } from '@/lib/idempotency'
import { computeWordHashSet } from '@/lib/client-hash'
import { pickNextSurvivalPage } from '@/lib/survival-pool'

// Phase 3 MODE-03 — survival start route.
//
// Three branches:
//   1. Anonymous initial-start (no user, no gameId): pick a page, return payload with
//      `anonymous: true`. No games row, no idempotency. Client manages state in memory.
//   2. Anonymous chain-advance (no user, gameId present): 400. Scored chains need auth.
//   3. Authed initial-start (user, no gameId): insert games row, return payload.
//   4. Authed chain-advance (user + gameId + completedPageId): ownership-check row,
//      pick next page, call survival_advance_chain RPC, return next-article payload.
//
// Sacred <50ms reveal gate preserved via server-side wordHashSet (CLAUDE.md Core Value).

type StartResponse = {
  anonymous: boolean
  gameId?: string
  pageId: string
  tokens: any[]
  titleWords: any[]
  wordHashSet: string[]
  wikipedia_url: string
  livesRemaining: number
  chainLength: number
  language: 'fr' | 'en'
}

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, SurvivalStartSchema)
  if ('error' in parsed) return parsed.error
  const { lang, gameId, completedPageId, idempotencyKey } = parsed.data

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    // ─── Anonymous branch (W-3 resolution) ──────────────────────────────
    if (!user) {
      if (gameId) {
        return NextResponse.json(
          { error: 'Scored chain requires sign-in' },
          { status: 400 }
        )
      }
      const page = await pickNextSurvivalPage(null, lang, new Set())
      if (!page) {
        return NextResponse.json(
          { error: "Couldn't start the run. Try again in a moment." },
          { status: 500 }
        )
      }
      const wordHashSet = computeWordHashSet(page.tokens ?? [], page.title_tokens ?? [])
      const body: StartResponse = {
        anonymous: true,
        pageId: page.id,
        tokens: maskTokensForClient(page.tokens ?? []),
        titleWords: maskTitleForClient(page.title_tokens ?? []),
        wordHashSet,
        wikipedia_url: page.wikipedia_url,
        livesRemaining: 3,
        chainLength: 0,
        language: lang,
      }
      return NextResponse.json(body)
    }

    // ─── Authed branches ────────────────────────────────────────────────
    // Idempotency wrap (only meaningful when a gameId is present — anon + initial
    // have no stable key).
    const slot = gameId && idempotencyKey
      ? await acquireIdempotencySlot<StartResponse>(gameId, idempotencyKey)
      : null
    if (slot && slot.kind === 'replay') {
      return NextResponse.json(slot.response)
    }

    // Chain-advance path
    if (gameId) {
      if (!completedPageId) {
        return NextResponse.json(
          { error: 'completedPageId required for chain advance' },
          { status: 400 }
        )
      }

      const { data: gameRow, error: loadErr } = await supabaseAdmin
        .from('games')
        .select('id, user_id, mode, mode_config')
        .eq('id', gameId)
        .eq('user_id', user.id)
        .eq('mode', 'survival')
        .maybeSingle()
      if (loadErr) {
        Sentry.captureException(loadErr, {
          tags: { context: 'api/survival/start', phase: 'load-game' },
          extra: { gameId, userId: user.id },
        })
        return NextResponse.json(
          { error: "Couldn't start the run. Try again in a moment." },
          { status: 500 }
        )
      }
      if (!gameRow) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 })
      }

      const mc = (gameRow.mode_config ?? {}) as any
      const chain = Array.isArray(mc.chain) ? mc.chain : []
      const excludeIds = new Set<string>(
        chain.map((e: any) => e?.page_id as string).filter(Boolean)
      )
      excludeIds.add(completedPageId)

      const page = await pickNextSurvivalPage(user.id, lang, excludeIds)
      if (!page) {
        return NextResponse.json(
          { error: "Couldn't start the run. Try again in a moment." },
          { status: 500 }
        )
      }

      const { data: newConfig, error: rpcErr } = await supabaseAdmin.rpc(
        'survival_advance_chain',
        {
          p_game_id: gameId,
          p_completed_article: completedPageId,
          p_outcome: 'completed',
          p_next_article: page.id,
        }
      )
      if (rpcErr) {
        Sentry.captureException(rpcErr, {
          tags: { context: 'api/survival/start', phase: 'rpc' },
          extra: { gameId, userId: user.id },
        })
        return NextResponse.json(
          { error: "Couldn't advance the chain. Try again in a moment." },
          { status: 500 }
        )
      }

      const nextMc = (newConfig ?? {}) as any
      const livesRemaining = Number(nextMc.lives_remaining ?? 3)
      const chainLength = Array.isArray(nextMc.chain) ? nextMc.chain.length : 0
      const wordHashSet = computeWordHashSet(page.tokens ?? [], page.title_tokens ?? [])
      const body: StartResponse = {
        anonymous: false,
        gameId,
        pageId: page.id,
        tokens: maskTokensForClient(page.tokens ?? []),
        titleWords: maskTitleForClient(page.title_tokens ?? []),
        wordHashSet,
        wikipedia_url: page.wikipedia_url,
        livesRemaining,
        chainLength,
        language: lang,
      }
      if (slot && slot.kind === 'fresh') await slot.commit(body)
      return NextResponse.json(body)
    }

    // Initial-start path (authed, no gameId)
    const page = await pickNextSurvivalPage(user.id, lang, new Set())
    if (!page) {
      return NextResponse.json(
        { error: "Couldn't start the run. Try again in a moment." },
        { status: 500 }
      )
    }

    const nowIso = new Date().toISOString()
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('games')
      .insert({
        user_id: user.id,
        page_id: page.id,
        lang,
        guess_count: 0,
        completed: false,
        mode: 'survival',
        mode_config: {
          lives_remaining: 3,
          chain: [],
          current_page_id: page.id,
          started_at: nowIso,
          language: lang,
        },
        started_at: nowIso,
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      Sentry.captureException(insertErr ?? new Error('insert returned no row'), {
        tags: { context: 'api/survival/start', phase: 'insert' },
        extra: { userId: user.id },
      })
      return NextResponse.json(
        { error: "Couldn't start the run. Try again in a moment." },
        { status: 500 }
      )
    }

    const wordHashSet = computeWordHashSet(page.tokens ?? [], page.title_tokens ?? [])
    const body: StartResponse = {
      anonymous: false,
      gameId: inserted.id,
      pageId: page.id,
      tokens: maskTokensForClient(page.tokens ?? []),
      titleWords: maskTitleForClient(page.title_tokens ?? []),
      wordHashSet,
      wikipedia_url: page.wikipedia_url,
      livesRemaining: 3,
      chainLength: 0,
      language: lang,
    }
    // No idempotency commit on initial-start (no gameId was known at parse-time).
    return NextResponse.json(body)
  } catch (err) {
    Sentry.captureException(err, {
      tags: { context: 'api/survival/start' },
    })
    return NextResponse.json(
      { error: "Couldn't start the run. Try again in a moment." },
      { status: 500 }
    )
  }
}
