import { Redis } from '@upstash/redis'
import * as Sentry from '@sentry/nextjs'

let client: Redis | null = null

function getClient(): Redis | null {
  if (client) return client
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  client = Redis.fromEnv()
  return client
}

export async function safeGet(key: string): Promise<string | null> {
  const r = getClient()
  if (!r) return null
  try {
    const v = await r.get<string>(key)
    return typeof v === 'string' ? v : null
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'redis', op: 'safeGet' } })
    return null
  }
}

export async function safeSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const r = getClient()
  if (!r) return
  try {
    await r.set(key, value, { ex: ttlSeconds })
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'redis', op: 'safeSet' } })
  }
}
