import * as Sentry from '@sentry/nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ReplayResult<T> =
  | { kind: 'replay'; response: T }
  | { kind: 'fresh'; commit: (response: T) => Promise<void> }

/**
 * Stripe-style server-side idempotency.
 *
 * Looks up (gameId, key) in idempotency_keys. If a non-expired row exists,
 * returns { kind: 'replay', response } — caller returns this verbatim with
 * HTTP 200 and a body identical to the first call's body.
 *
 * On miss, returns { kind: 'fresh', commit }. Caller runs its handler,
 * then awaits commit(response) to persist the cached body for replay.
 *
 * Race safety: commit() uses upsert with ignoreDuplicates so that two
 * concurrent fresh requests that both miss the lookup will both write,
 * but the second write is silently dropped by ON CONFLICT DO NOTHING.
 *
 * Pruning: commit() also fire-and-forget DELETEs expired rows. Bounded
 * volume (~1 row per active guess; 60s TTL) keeps the table tiny without
 * pg_cron.
 *
 * GRACEFUL DEGRADATION (fail-open): if the upsert/lookup hits the table
 * and it does not exist yet (e.g., code deployed before the DDL landed)
 * or any other Supabase error occurs, we log to Sentry and return a
 * safe "fresh" slot whose commit() is a no-op. The guess flow continues
 * as if idempotency were disabled. Losing dedup guarantees temporarily
 * is far better than breaking the guess endpoint.
 *
 * Usage:
 *   const slot = await acquireIdempotencySlot<GuessResponse>(gameId, key)
 *   if (slot.kind === 'replay') return NextResponse.json(slot.response)
 *   // ... run handler, produce responseBody ...
 *   await slot.commit(responseBody)
 *   return NextResponse.json(responseBody)
 */
export async function acquireIdempotencySlot<T>(
  gameId: string,
  key: string
): Promise<ReplayResult<T>> {
  // Fast path: look up existing key. .single() returns an error on zero
  // rows (PGRST116) — we treat that as a miss, not a failure. Any OTHER
  // error (table missing, network, permissions) is fail-open.
  try {
    const { data: existing, error } = await supabaseAdmin
      .from('idempotency_keys')
      .select('response, expires_at')
      .eq('game_id', gameId)
      .eq('key', key)
      .maybeSingle()

    if (error) {
      // Table missing, permission denied, transient — log and fail open.
      Sentry.captureException(error, {
        tags: { context: 'idempotency', phase: 'lookup' },
        extra: { gameId, key },
      })
      return { kind: 'fresh', commit: async () => {} }
    }

    if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
      return { kind: 'replay', response: existing.response as T }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { context: 'idempotency', phase: 'lookup' },
      extra: { gameId, key },
    })
    return { kind: 'fresh', commit: async () => {} }
  }

  return {
    kind: 'fresh',
    commit: async (response: T) => {
      try {
        const { error } = await supabaseAdmin
          .from('idempotency_keys')
          .upsert(
            { game_id: gameId, key, response: response as object },
            { onConflict: 'game_id,key', ignoreDuplicates: true }
          )
        if (error) {
          Sentry.captureException(error, {
            tags: { context: 'idempotency', phase: 'commit' },
            extra: { gameId, key },
          })
          // Fail open — caller still returns the response.
          return
        }
      } catch (err) {
        Sentry.captureException(err, {
          tags: { context: 'idempotency', phase: 'commit' },
          extra: { gameId, key },
        })
        return
      }
      // Lazy prune — fire-and-forget; do not block the response.
      void supabaseAdmin
        .from('idempotency_keys')
        .delete()
        .lt('expires_at', new Date().toISOString())
    },
  }
}
