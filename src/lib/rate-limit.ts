/**
 * Fixed-window per-user rate limiter. Phase 11 / FR-01, FR-02.
 *
 * Returns false if the caller is over the limit in the current window.
 * Fail-open: if Redis is unavailable (env missing or .get throws),
 * allow the request — abuse exposure is strictly bounded to prod where
 * Upstash env vars are always present; dev/test never rate-limits.
 *
 * Key format: ratelimit:v1:{route}:{userId}:{floor(now/windowSec)}
 * TTL: windowSec + 5 (cushion so a key cannot outlive its window).
 */
import { safeGet, safeSet } from '@/lib/redis'

export async function rateLimitOk(
  userId: string,
  route: string,
  limit: number,
  windowSec: number = 60,
): Promise<boolean> {
  const window = Math.floor(Date.now() / 1000 / windowSec)
  const key = `ratelimit:v1:${route}:${userId}:${window}`
  const current = await safeGet(key)
  if (current === null) {
    await safeSet(key, '1', windowSec + 5)
    return true
  }
  const count = parseInt(current, 10) || 0
  if (count >= limit) return false
  // Race-ok: last writer wins; +/-1 error is acceptable for rate-limiting
  await safeSet(key, String(count + 1), windowSec + 5)
  return true
}
