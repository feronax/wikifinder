import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { maskTokensForClient, maskTitleForClient } from '@/lib/tokenize'
import { parseJsonBody, SurvivalGiveUpSchema } from '@/lib/validation'
import { acquireIdempotencySlot } from '@/lib/idempotency'
import { computeWordHashSet } from '@/lib/client-hash'
import { pickNextSurvivalPage } from '@/lib/survival-pool'
import { calculateScore, calculateSurvivalScore } from '@/lib/scoring'

// Phase 3 MODE-03 — survival give-up route.
//
// Decrements lives_remaining by 1 via survival_advance_chain RPC (which clamps
// with GREATEST(0, ...)). If lives reach 0, inlines the end-of-run scoring path
// and returns the end payload (same shape as /api/survival/end). Otherwise
// returns the next article payload so the client can keep playing.

type NextPayload = {
  next: {
    pageId: string
    tokens: any[]
    titleWords: any[]
    wordHashSet: string[]
    wikipedia_url: string
  }
  livesRemaining: number
  chainLength: number
}

type EndPayload = {
  ended: true
  score: number
  chainLength: number
  chain: { outcome: string }[]
  durationSec: number
  shareText: string
}

type GiveUpResponse = NextPayload | EndPayload

function buildSurvivalShareText(params: {
  chain: { outcome: string }[]
  score: number
}): string {
  const emojis = params.chain
    .map(e => (e.outcome === 'completed' ? '🟩' : '🟥'))
    .join('')
  return (
    `Wikifinder Survival\n${emojis}\n` +
    `Chain: ${params.chain.length} · Score: ${params.score}\n` +
    `https://wikifinder.vercel.app`
  )
}

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, SurvivalGiveUpSchema)
  if ('error' in parsed) return parsed.error
  const { gameId, idempotencyKey } = parsed.data

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })
    }

    // Load the row (ownership-checked; mode-scoped).
    const { data: gameRow, error: loadErr } = await supabaseAdmin
      .from('games')
      .select('id, user_id, page_id, mode, mode_config, started_at')
      .eq('id', gameId)
      .eq('user_id', user.id)
      .eq('mode', 'survival')
      .maybeSingle()
    if (loadErr) {
      Sentry.captureException(loadErr, {
        tags: { context: 'api/survival/give-up', phase: 'load' },
        extra: { gameId, userId: user.id },
      })
      return NextResponse.json(
        { error: "Couldn't give up. Try again in a moment." },
        { status: 500 }
      )
    }
    if (!gameRow) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const mc = (gameRow.mode_config ?? {}) as any
    const currentLives = Number(mc.lives_remaining ?? 0)
    if (currentLives <= 0) {
      return NextResponse.json({ error: 'Run already ended' }, { status: 400 })
    }

    // Idempotency slot (after cheap validations to avoid caching 400s).
    const slot = idempotencyKey
      ? await acquireIdempotencySlot<GiveUpResponse>(gameId, idempotencyKey)
      : null
    if (slot && slot.kind === 'replay') {
      return NextResponse.json(slot.response)
    }

    const language = (mc.language === 'en' ? 'en' : 'fr') as 'fr' | 'en'
    const chain = Array.isArray(mc.chain) ? mc.chain : []
    const excludeIds = new Set<string>(
      chain.map((e: any) => e?.page_id as string).filter(Boolean)
    )
    if (mc.current_page_id) excludeIds.add(mc.current_page_id)

    const nextPage = await pickNextSurvivalPage(user.id, language, excludeIds)
    if (!nextPage) {
      return NextResponse.json(
        { error: "Couldn't give up. Try again in a moment." },
        { status: 500 }
      )
    }

    const { data: newConfig, error: rpcErr } = await supabaseAdmin.rpc(
      'survival_advance_chain',
      {
        p_game_id: gameId,
        p_completed_article: mc.current_page_id,
        p_outcome: 'gave_up',
        p_next_article: nextPage.id,
      }
    )
    if (rpcErr) {
      Sentry.captureException(rpcErr, {
        tags: { context: 'api/survival/give-up', phase: 'rpc' },
        extra: { gameId, userId: user.id },
      })
      return NextResponse.json(
        { error: "Couldn't give up. Try again in a moment." },
        { status: 500 }
      )
    }

    const nextMc = (newConfig ?? {}) as any
    // Pitfall 3: postgres may round-trip integers as strings via JSONB path expressions
    // depending on coercion; Number() guards both cases.
    const lives = Number(nextMc.lives_remaining ?? 0)
    const nextChain: { page_id: string; outcome: string }[] = Array.isArray(nextMc.chain)
      ? nextMc.chain
      : []
    const chainLength = nextChain.length

    if (lives === 0) {
      // Inline end-of-run: compute score + persist.
      const { data: guessRows } = await supabaseAdmin
        .from('guesses')
        .select('page_id')
        .eq('game_id', gameId)
      const guessCountByPageId = new Map<string, number>()
      for (const row of guessRows ?? []) {
        const pid = (row as any).page_id as string
        guessCountByPageId.set(pid, (guessCountByPageId.get(pid) ?? 0) + 1)
      }
      const articleScores = nextChain.map(e =>
        e.outcome === 'completed'
          ? calculateScore(guessCountByPageId.get(e.page_id) ?? 0, true)
          : 0
      )
      const score = calculateSurvivalScore(articleScores, chainLength)

      const { error: updErr } = await supabaseAdmin
        .from('games')
        .update({
          score,
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', gameId)
        .eq('user_id', user.id)
      if (updErr) {
        Sentry.captureException(updErr, {
          tags: { context: 'api/survival/give-up', phase: 'end-update' },
          extra: { gameId, userId: user.id },
        })
        return NextResponse.json(
          { error: "Couldn't finalize the run." },
          { status: 500 }
        )
      }

      const startedAtIso: string = (mc.started_at as string) ?? gameRow.started_at
      const durationSec = Math.max(
        0,
        Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000)
      )
      const chainShape = nextChain.map(e => ({ outcome: e.outcome }))
      const body: EndPayload = {
        ended: true,
        score,
        chainLength,
        chain: chainShape,
        durationSec,
        shareText: buildSurvivalShareText({ chain: chainShape, score }),
      }
      if (slot && slot.kind === 'fresh') await slot.commit(body)
      return NextResponse.json(body)
    }

    // Normal path: return next article.
    const wordHashSet = computeWordHashSet(
      nextPage.tokens ?? [],
      nextPage.title_tokens ?? []
    )
    const body: NextPayload = {
      next: {
        pageId: nextPage.id,
        tokens: maskTokensForClient(nextPage.tokens ?? []),
        titleWords: maskTitleForClient(nextPage.title_tokens ?? []),
        wordHashSet,
        wikipedia_url: nextPage.wikipedia_url,
      },
      livesRemaining: lives,
      chainLength,
    }
    if (slot && slot.kind === 'fresh') await slot.commit(body)
    return NextResponse.json(body)
  } catch (err) {
    Sentry.captureException(err, {
      tags: { context: 'api/survival/give-up' },
    })
    return NextResponse.json(
      { error: "Couldn't give up. Try again in a moment." },
      { status: 500 }
    )
  }
}
