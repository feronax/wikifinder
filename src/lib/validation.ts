import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { NextResponse } from 'next/server'

/**
 * Schémas de validation partagés pour les routes API.
 *
 * Priorité latence : garder les schémas plats et simples sur les hot paths
 * (/api/game/guess, /api/game/today, /api/ranked/start). Zod sur un schéma
 * d'objet de ~5 champs = < 1ms, négligeable.
 */

export const LangSchema = z.enum(['fr', 'en'])

/** UUID format standard (used for pageId, gameId, userId). */
export const UuidSchema = z.string().uuid()

/** Date YYYY-MM-DD (utilisée pour la date de page du jour). */
export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * Mot d'un guess utilisateur. Trim côté serveur, limite large car certaines
 * langues autorisent des mots longs (ex: allemand, mais on reste sur fr/en).
 * Non-vide et ≤ 60 chars — au-delà, c'est du spam.
 */
export const GuessWordSchema = z.string().trim().min(1).max(60)

/** Message de feedback — borné pour éviter abus stockage. */
export const FeedbackMessageSchema = z.string().trim().min(1).max(2000)

/** Data URI d'un screenshot — borné à 5MB encodé base64. */
export const ScreenshotDataSchema = z.string().max(6_500_000)

// Phase 3 MODE-03 (D-16): survival route body schemas. Flat, UUID-typed, no
// nested objects — keeps parse <1ms on the hot path per the top-of-file convention.
// Extra fields (e.g. client-supplied `score`) are silently stripped by Zod default
// strip behavior — server-only writes remain authoritative (03-01 carry-forward).
export const SurvivalStartSchema = z.object({
  lang: LangSchema,
  idempotencyKey: UuidSchema.optional(),
  gameId: UuidSchema.optional(),
  completedPageId: UuidSchema.optional(),
})

export const SurvivalGiveUpSchema = z.object({
  gameId: UuidSchema,
  idempotencyKey: UuidSchema.optional(),
})

export const SurvivalEndSchema = z.object({
  gameId: UuidSchema,
  idempotencyKey: UuidSchema.optional(),
})

/**
 * Parse et valide un body JSON. Retourne `{ data }` ou `{ error: Response }`.
 * Usage :
 *   const parsed = await parseJsonBody(req, MySchema)
 *   if ('error' in parsed) return parsed.error
 *   const { ... } = parsed.data
 */
export async function parseJsonBody<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { error: NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    // On ne renvoie PAS les détails Zod au client (évite la fuite d'info schéma).
    // Les détails partent vers Sentry (server-side uniquement) pour debug.
    Sentry.captureMessage('[validation] body parse failed', {
      level: 'warning',
      tags: { context: 'validation' },
      extra: { issues: result.error.issues },
    })
    return { error: NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 }) }
  }
  return { data: result.data }
}

/**
 * Parse et valide les query params d'une URL. Tous les params sont des
 * strings au départ ; utilise z.coerce.* si tu veux les typer (nombre, etc.).
 */
export function parseSearchParams<T extends z.ZodType>(
  url: URL,
  schema: T
): { data: z.infer<T> } | { error: NextResponse } {
  const obj: Record<string, string> = {}
  for (const [k, v] of url.searchParams.entries()) obj[k] = v
  const result = schema.safeParse(obj)
  if (!result.success) {
    Sentry.captureMessage('[validation] query parse failed', {
      level: 'warning',
      tags: { context: 'validation' },
      extra: { issues: result.error.issues },
    })
    return { error: NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 }) }
  }
  return { data: result.data }
}
