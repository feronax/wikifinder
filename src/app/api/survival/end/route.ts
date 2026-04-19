import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseJsonBody, SurvivalEndSchema } from '@/lib/validation'
import { acquireIdempotencySlot } from '@/lib/idempotency'
import { calculateScore, calculateSurvivalScore } from '@/lib/scoring'

// Phase 3 MODE-04 — survival end route.
//
// Computes per-article scores from the `guesses` table, aggregates via
// calculateSurvivalScore (single source of truth per D-11), persists to
// games.score, and returns the share-card payload. Client-supplied `score` is
// already stripped at the Zod layer (03-01 carry-forward).

type EndResponse = {
  score: number
  chainLength: number
  chain: { outcome: string }[]
  durationSec: number
  shareText: string
}

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
  const parsed = await parseJsonBody(req, SurvivalEndSchema)
  if ('error' in parsed) return parsed.error
  const { gameId, idempotencyKey } = parsed.data

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })
    }

    const slot = idempotencyKey
      ? await acquireIdempotencySlot<EndResponse>(gameId, idempotencyKey)
      : null
    if (slot && slot.kind === 'replay') {
      return NextResponse.json(slot.response)
    }

    const { data: gameRow, error: loadErr } = await supabaseAdmin
      .from('games')
      .select('id, user_id, mode, mode_config, started_at, completed')
      .eq('id', gameId)
      .eq('user_id', user.id)
      .eq('mode', 'survival')
      .maybeSingle()
    if (loadErr) {
      Sentry.captureException(loadErr, {
        tags: { context: 'api/survival/end', phase: 'load' },
        extra: { gameId, userId: user.id },
      })
      return NextResponse.json(
        { error: "Couldn't finalize the run." },
        { status: 500 }
      )
    }
    if (!gameRow) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const mc = (gameRow.mode_config ?? {}) as any
    const chain: { page_id: string; outcome: string }[] = Array.isArray(mc.chain)
      ? mc.chain
      : []
    const chainLength = chain.length

    // [api/survival/end] per-article guess counts aggregated from guesses table;
    // see CONTEXT D-09/D-10 — given-up articles score 0 but count for the multiplier.
    const { data: guessRows } = await supabaseAdmin
      .from('guesses')
      .select('page_id')
      .eq('game_id', gameId)
    const guessCountByPageId = new Map<string, number>()
    for (const row of guessRows ?? []) {
      const pid = (row as any).page_id as string
      guessCountByPageId.set(pid, (guessCountByPageId.get(pid) ?? 0) + 1)
    }

    const articleScores = chain.map(e =>
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
        tags: { context: 'api/survival/end', phase: 'update' },
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

    const chainShape = chain.map(e => ({ outcome: e.outcome }))
    const body: EndResponse = {
      score,
      chainLength,
      chain: chainShape,
      durationSec,
      shareText: buildSurvivalShareText({ chain: chainShape, score }),
    }
    if (slot && slot.kind === 'fresh') await slot.commit(body)
    return NextResponse.json(body)
  } catch (err) {
    Sentry.captureException(err, {
      tags: { context: 'api/survival/end' },
    })
    return NextResponse.json(
      { error: "Couldn't finalize the run." },
      { status: 500 }
    )
  }
}
