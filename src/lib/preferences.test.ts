import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'

// Supabase mock: per-test control of auth + table chain behaviour.
type MaybeSingleResult = { data: { preferences: unknown } | null; error: unknown }

const selectMaybeSingle = vi.fn<() => Promise<MaybeSingleResult>>()
const updateResolver = vi.fn<(payload: { preferences: unknown }) => Promise<{ data: unknown; error: unknown }>>()
const getUserMock = vi.fn<() => Promise<{ data: { user: { id: string } | null } }>>()

function makeFromChain() {
  const eqUpdate = vi.fn((_col: string, _val: string) => updateResolver(updateCalls.at(-1)?.payload as { preferences: unknown }))
  const update = vi.fn((payload: { preferences: unknown }) => {
    updateCalls.push({ payload })
    return { eq: eqUpdate }
  })
  const select = vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: selectMaybeSingle,
    })),
  }))
  return { select, update }
}

const updateCalls: { payload: { preferences: unknown } }[] = []

vi.mock('@/lib/supabase', () => ({
  createSupabaseBrowserClient: () => ({
    from: (_t: string) => makeFromChain(),
    auth: { getUser: () => getUserMock() },
  }),
}))

// Import AFTER mock registration
import {
  loadLocalPrefs,
  saveLocalPrefs,
  usePreferenceSync,
  usePreferencesBootstrap,
  type Preferences,
} from './preferences'

describe('preferences', () => {
  beforeEach(() => {
    localStorage.clear()
    selectMaybeSingle.mockReset()
    updateResolver.mockReset()
    getUserMock.mockReset()
    updateCalls.length = 0
    // default: select returns an empty row (preferences = {})
    selectMaybeSingle.mockResolvedValue({ data: { preferences: {} }, error: null })
    updateResolver.mockResolvedValue({ data: null, error: null })
    getUserMock.mockResolvedValue({ data: { user: null } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('loadLocalPrefs', () => {
    it('returns {} when wf_prefs is absent', () => {
      expect(loadLocalPrefs()).toEqual({})
    })

    it('returns {} on malformed JSON', () => {
      localStorage.setItem('wf_prefs', '{not json')
      expect(loadLocalPrefs()).toEqual({})
    })

    it('returns parsed object when wf_prefs present', () => {
      localStorage.setItem('wf_prefs', JSON.stringify({ lang: 'en', mode: 'dark' }))
      expect(loadLocalPrefs()).toEqual({ lang: 'en', mode: 'dark' })
    })

    it('migrates legacy theme=dark into wf_prefs.mode and deletes theme', () => {
      localStorage.setItem('theme', 'dark')
      const out = loadLocalPrefs()
      expect(out).toEqual({ mode: 'dark' })
      expect(localStorage.getItem('theme')).toBeNull()
      expect(JSON.parse(localStorage.getItem('wf_prefs') || '{}')).toEqual({ mode: 'dark' })
    })

    it('migration is idempotent: second call yields same result', () => {
      localStorage.setItem('theme', 'light')
      const first = loadLocalPrefs()
      const second = loadLocalPrefs()
      expect(first).toEqual({ mode: 'light' })
      expect(second).toEqual({ mode: 'light' })
      expect(localStorage.getItem('theme')).toBeNull()
    })

    it('preserves existing wf_prefs when legacy theme key lingers; still deletes theme', () => {
      localStorage.setItem('wf_prefs', JSON.stringify({ lang: 'en', mode: 'light' }))
      localStorage.setItem('theme', 'dark')
      const out = loadLocalPrefs()
      expect(out).toEqual({ lang: 'en', mode: 'light' })
      expect(localStorage.getItem('theme')).toBeNull()
    })
  })

  describe('saveLocalPrefs', () => {
    it('merges into existing wf_prefs without clobbering siblings', () => {
      localStorage.setItem('wf_prefs', JSON.stringify({ mode: 'dark' }))
      saveLocalPrefs({ lang: 'en' })
      expect(JSON.parse(localStorage.getItem('wf_prefs') || '{}')).toEqual({ mode: 'dark', lang: 'en' })
    })
  })

  describe('usePreferenceSync', () => {
    it('debounces: 5 rapid calls → ONE Supabase update after 500ms', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => usePreferenceSync())
      const queueSync = result.current
      act(() => {
        queueSync({ lang: 'fr' }, 'uid-1')
        queueSync({ lang: 'en' }, 'uid-1')
        queueSync({ mode: 'dark' }, 'uid-1')
        queueSync({ mode: 'light' }, 'uid-1')
        queueSync({ lang: 'en', mode: 'dark' }, 'uid-1')
      })
      expect(updateCalls.length).toBe(0)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
        await vi.runAllTimersAsync()
      })
      expect(updateCalls.length).toBe(1)
      expect(updateCalls[0].payload).toEqual({ preferences: { lang: 'en', mode: 'dark' } })
    })

    it('anon (userId null) → zero Supabase calls', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => usePreferenceSync())
      act(() => {
        result.current({ lang: 'en' }, null)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })
      expect(updateCalls.length).toBe(0)
      expect(selectMaybeSingle).not.toHaveBeenCalled()
    })

    it('W1 AbortController race: new call cancels in-flight pipeline', async () => {
      vi.useFakeTimers()
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
      // Slow select: returns after a 200ms delay
      let resolveFirstSelect: ((v: MaybeSingleResult) => void) | null = null
      selectMaybeSingle.mockImplementationOnce(
        () => new Promise<MaybeSingleResult>((res) => { resolveFirstSelect = res })
      )
      selectMaybeSingle.mockResolvedValue({ data: { preferences: {} }, error: null })

      const { result } = renderHook(() => usePreferenceSync())
      const queueSync = result.current

      act(() => { queueSync({ lang: 'fr' }, 'uid-1') })
      // Fire the first flush
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      // At this point, the first pipeline is awaiting selectMaybeSingle.

      // Now queue a second patch BEFORE the first select resolves.
      act(() => { queueSync({ lang: 'en' }, 'uid-1') })
      expect(abortSpy).toHaveBeenCalled()

      // Resolve the first select (should be observed as aborted → no update)
      resolveFirstSelect!({ data: { preferences: {} }, error: null })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
        await vi.runAllTimersAsync()
      })

      // Only one update should have landed — the second patch's
      expect(updateCalls.length).toBe(1)
      expect(updateCalls[0].payload).toEqual({ preferences: { lang: 'en' } })
      abortSpy.mockRestore()
    })

    it('W3 unknown-keys passthrough: preserves direction=rtl on merge', async () => {
      vi.useFakeTimers()
      selectMaybeSingle.mockResolvedValue({
        data: { preferences: { direction: 'rtl', lang: 'fr' } },
        error: null,
      })
      const { result } = renderHook(() => usePreferenceSync())
      act(() => { result.current({ lang: 'en' }, 'uid-1') })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
        await vi.runAllTimersAsync()
      })
      expect(updateCalls.length).toBe(1)
      expect(updateCalls[0].payload).toEqual({
        preferences: { direction: 'rtl', lang: 'en' },
      })
    })

    it('unmount cleanup: no update if unmounted before debounce fires', async () => {
      vi.useFakeTimers()
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
      const { result, unmount } = renderHook(() => usePreferenceSync())
      act(() => { result.current({ lang: 'en' }, 'uid-1') })
      unmount()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
        await vi.runAllTimersAsync()
      })
      expect(updateCalls.length).toBe(0)
      abortSpy.mockRestore()
    })

    it('debounceArmed: true after queueSync, false once idle', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => usePreferenceSync())
      const queueSync = result.current
      expect(queueSync.debounceArmed()).toBe(false)
      act(() => { queueSync({ lang: 'en' }, 'uid-1') })
      expect(queueSync.debounceArmed()).toBe(true)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
        await vi.runAllTimersAsync()
      })
      expect(queueSync.debounceArmed()).toBe(false)
    })
  })

  describe('usePreferencesBootstrap', () => {
    function harness(opts: {
      onHydrated: (p: Preferences) => void
      armDebounce?: boolean
      patchOnMount?: Preferences
    }) {
      function Setup() {
        const userIdRef = useRef<string | null>(null)
        const queueSync = usePreferenceSync()
        if (opts.armDebounce) {
          // Arm the debounce without actually scheduling a real Supabase call on the mock:
          // we call with a userId; the outer test must handle the eventual flush side effects
          // by keeping fake timers un-advanced OR by letting anon short-circuit. Simpler:
          // call with null-user → still sets the timer? No — anon short-circuits BEFORE timer.
          // So for the debounce-armed test we pass a uid; the test must NOT advance timers.
          queueSync(opts.patchOnMount ?? { lang: 'fr' }, 'uid-arm')
        }
        usePreferencesBootstrap({
          userIdRef,
          queueSync,
          onHydrated: opts.onHydrated,
        })
        return { userIdRef, queueSync }
      }
      return renderHook(() => Setup())
    }

    it('anon: onHydrated never called; no profiles fetch', async () => {
      getUserMock.mockResolvedValue({ data: { user: null } })
      const onHydrated = vi.fn()
      harness({ onHydrated })
      // Flush microtasks for getUser()
      await act(async () => { await Promise.resolve() })
      await act(async () => { await Promise.resolve() })
      expect(onHydrated).not.toHaveBeenCalled()
      expect(selectMaybeSingle).not.toHaveBeenCalled()
    })

    it('empty remote (R8): onHydrated skipped; userIdRef set', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'uid-42' } } })
      selectMaybeSingle.mockResolvedValue({ data: { preferences: {} }, error: null })
      const onHydrated = vi.fn()
      const { result } = harness({ onHydrated })
      await act(async () => { await Promise.resolve() })
      await act(async () => { await Promise.resolve() })
      await act(async () => { await Promise.resolve() })
      expect(onHydrated).not.toHaveBeenCalled()
      expect(result.current.userIdRef.current).toBe('uid-42')
      expect(localStorage.getItem('wf_prefs')).toBeNull()
    })

    it('populated remote: onHydrated called; localStorage written', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'uid-1' } } })
      selectMaybeSingle.mockResolvedValue({
        data: { preferences: { lang: 'en', mode: 'dark' } },
        error: null,
      })
      const onHydrated = vi.fn()
      const { result } = harness({ onHydrated })
      await act(async () => { await Promise.resolve() })
      await act(async () => { await Promise.resolve() })
      await act(async () => { await Promise.resolve() })
      expect(onHydrated).toHaveBeenCalledTimes(1)
      expect(onHydrated).toHaveBeenCalledWith({ lang: 'en', mode: 'dark' })
      expect(JSON.parse(localStorage.getItem('wf_prefs') || '{}')).toEqual({ lang: 'en', mode: 'dark' })
      expect(result.current.userIdRef.current).toBe('uid-1')
    })

    it('debounce-armed (R3): remote populated but onHydrated skipped', async () => {
      vi.useFakeTimers()
      getUserMock.mockResolvedValue({ data: { user: { id: 'uid-7' } } })
      selectMaybeSingle.mockResolvedValue({
        data: { preferences: { lang: 'en' } },
        error: null,
      })
      const onHydrated = vi.fn()
      harness({ onHydrated, armDebounce: true })
      // Let microtasks settle but do NOT advance 500ms — debounce stays armed.
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(onHydrated).not.toHaveBeenCalled()
      // localStorage was NOT overwritten with remote
      const stored = localStorage.getItem('wf_prefs')
      if (stored) {
        // only possible if bootstrap wrote it — which would be a failure
        expect(JSON.parse(stored)).not.toEqual({ lang: 'en' })
      }
    })
  })
})
