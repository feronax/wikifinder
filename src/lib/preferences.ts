'use client'

import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

// Shared preferences shape. JSONB in Supabase may contain additional future keys
// (e.g. direction: 'rtl'); we preserve unknown keys on read-modify-write.
export type Preferences = { lang?: 'fr' | 'en'; mode?: 'dark' | 'light' }

const STORAGE_KEY = 'wf_prefs'
const LEGACY_THEME_KEY = 'theme'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Read wf_prefs from localStorage. On first call (or whenever wf_prefs is absent),
// if a legacy localStorage['theme'] key of 'dark' | 'light' exists, migrate it into
// wf_prefs.mode and delete the legacy key. If wf_prefs already exists, still delete
// any lingering 'theme' key (one-shot cleanup) but preserve the wf_prefs contents.
// SSR-safe: returns {} when window/localStorage is undefined.
export function loadLocalPrefs(): Preferences {
  if (typeof localStorage === 'undefined') return {}

  let current: Preferences = {}
  const raw = localStorage.getItem(STORAGE_KEY)
  let hadStored = false
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw)
      if (isPlainObject(parsed)) {
        current = parsed as Preferences
        hadStored = true
      }
    } catch {
      current = {}
      hadStored = false
    }
  }

  const legacy = localStorage.getItem(LEGACY_THEME_KEY)
  if (legacy !== null) {
    if (!hadStored && (legacy === 'dark' || legacy === 'light')) {
      current = { ...current, mode: legacy as 'dark' | 'light' }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
      } catch {
        // storage full / blocked — swallow; legacy stays until next attempt
      }
    }
    try {
      localStorage.removeItem(LEGACY_THEME_KEY)
    } catch {
      // noop
    }
  }

  return current
}

// Merge-patch wf_prefs in localStorage. Never clobbers sibling keys.
// SSR-safe no-op when localStorage is undefined.
export function saveLocalPrefs(patch: Partial<Preferences>): void {
  if (typeof localStorage === 'undefined') return
  const current = loadLocalPrefs()
  const merged = { ...current, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // storage full / blocked — silent
  }
}

// Fetch profiles.preferences for a given userId. Returns null on error/missing,
// otherwise the parsed Preferences object (possibly empty).
export async function hydrateFromSupabase(userId: string): Promise<Preferences | null> {
  try {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) return null
    const prefs = (data as { preferences?: unknown }).preferences
    if (!isPlainObject(prefs)) return {}
    return prefs as Preferences
  } catch {
    return null
  }
}

export type QueueSync = ((patch: Partial<Preferences>, userId: string | null) => void) & {
  debounceArmed: () => boolean
}

// React hook: returns a stable queueSync(patch, userId) debounced at 500ms.
// - Coalesces multiple patches since last flush via a ref
// - Anon userId (null) short-circuits (D-08a)
// - AbortController cancels any in-flight pipeline when a new call arrives (W1)
// - Read-modify-write preserves unknown JSONB keys (W3)
// - Cleans up pending timer + aborts in-flight on unmount
export function usePreferenceSync(): QueueSync {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<Partial<Preferences>>({})
  const abortRef = useRef<AbortController | null>(null)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [])

  async function flush(): Promise<void> {
    const snapshot = pendingRef.current
    pendingRef.current = {}
    debounceRef.current = null
    const uid = userIdRef.current
    if (!uid) return

    const controller = new AbortController()
    abortRef.current = controller
    const signal = controller.signal

    try {
      const supabase = createSupabaseBrowserClient()
      const selectRes = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', uid)
        .maybeSingle()
      if (signal.aborted) return

      const existingRaw = (selectRes?.data as { preferences?: unknown } | null)?.preferences
      const existing = isPlainObject(existingRaw) ? (existingRaw as Record<string, unknown>) : {}
      const merged = { ...existing, ...snapshot }

      await supabase
        .from('profiles')
        .update({ preferences: merged })
        .eq('id', uid)
      if (signal.aborted) return
    } catch {
      // Network / Supabase errors: silent — local state is source of truth; next write retries.
    }
  }

  function queueSync(patch: Partial<Preferences>, userId: string | null): void {
    if (userId == null) return
    userIdRef.current = userId
    pendingRef.current = { ...pendingRef.current, ...patch }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    // Cancel any in-flight pipeline from a previous flush (W1).
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    debounceRef.current = setTimeout(() => { void flush() }, 500)
  }

  const fn = queueSync as QueueSync
  fn.debounceArmed = () => debounceRef.current !== null
  return fn
}

// Bootstrap hook: on mount, resolves auth, fetches remote prefs, and hands them
// off via onHydrated if they should win over local state.
// - Anon (no user) → no-op
// - Debounce armed (R3) → skip remote overwrite (local change in flight wins)
// - Empty remote (R8) → skip (treat like anon; don't stomp local defaults)
// - Otherwise → saveLocalPrefs(remote) + onHydrated(remote)
export function usePreferencesBootstrap(params: {
  userIdRef: MutableRefObject<string | null>
  queueSync: QueueSync
  onHydrated: (remote: Preferences) => void
}): void {
  const { userIdRef, queueSync, onHydrated } = params
  // Keep latest callbacks without re-running the effect.
  const onHydratedRef = useRef(onHydrated)
  onHydratedRef.current = onHydrated
  const queueSyncRef = useRef(queueSync)
  queueSyncRef.current = queueSync
  const userIdRefRef = useRef(userIdRef)
  userIdRefRef.current = userIdRef

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const res = await supabase.auth.getUser()
        if (cancelled) return
        const user = res?.data?.user
        if (!user) return
        userIdRefRef.current.current = user.id

        const remote = await hydrateFromSupabase(user.id)
        if (cancelled) return
        if (!remote || Object.keys(remote).length === 0) return
        if (queueSyncRef.current.debounceArmed()) return

        saveLocalPrefs(remote)
        onHydratedRef.current(remote)
      } catch {
        // Silent — bootstrap is best-effort.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
}
