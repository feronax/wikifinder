import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import ThemeProvider, { useTheme } from './ThemeProvider'
import { tokens as tokensData } from '@/lib/design/tokens'
import type { Preferences } from '@/lib/preferences'

const hoisted = vi.hoisted(() => {
  const state = {
    onHydrated: null as null | ((remote: Preferences) => void),
    bootstrapCalls: 0,
    calls: [] as Array<[Partial<Preferences>, string | null]>,
  }
  return { state }
})

// Use the real loadLocalPrefs/saveLocalPrefs (for legacy migration coverage),
// but mock the Supabase-touching hooks so tests stay isolated.
vi.mock('@/lib/preferences', async () => {
  const actual = await vi.importActual<typeof import('@/lib/preferences')>('@/lib/preferences')
  const queueSync = Object.assign(
    (patch: Partial<Preferences>, userId: string | null) => {
      hoisted.state.calls.push([patch, userId])
    },
    { debounceArmed: () => false },
  )
  return {
    loadLocalPrefs: actual.loadLocalPrefs,
    saveLocalPrefs: actual.saveLocalPrefs,
    usePreferenceSync: () => queueSync,
    usePreferencesBootstrap: (params: {
      userIdRef: MutableRefObject<string | null>
      queueSync: typeof queueSync
      onHydrated: (remote: Preferences) => void
    }) => {
      hoisted.state.bootstrapCalls += 1
      hoisted.state.onHydrated = params.onHydrated
    },
  }
})

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  hoisted.state.onHydrated = null
  hoisted.state.bootstrapCalls = 0
  hoisted.state.calls.length = 0
})

describe('useTheme — default mode', () => {
  it('defaults to light when no localStorage and no system preference', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('light')
    expect(result.current.theme).toBe('light')
    expect(result.current.tokens).toBe(tokensData.light)
  })

  it('respects wf_prefs.mode saved value', () => {
    localStorage.setItem('wf_prefs', JSON.stringify({ mode: 'light' }))
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('light')
  })
})

describe('useTheme — setMode', () => {
  it('setMode("dark") updates state, DOM attribute, wf_prefs, and tokens (NOT legacy theme key)', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setMode('dark'))
    expect(result.current.mode).toBe('dark')
    expect(result.current.theme).toBe('dark')
    expect(result.current.tokens).toBe(tokensData.dark)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    const raw = localStorage.getItem('wf_prefs')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string).mode).toBe('dark')
    // Legacy key must NEVER be written by setMode.
    expect(localStorage.getItem('theme')).toBeNull()
  })

  it('setMode("light") reverses setMode("dark")', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setMode('dark'))
    act(() => result.current.setMode('light'))
    expect(result.current.mode).toBe('light')
    expect(result.current.tokens).toBe(tokensData.light)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(JSON.parse(localStorage.getItem('wf_prefs') as string).mode).toBe('light')
  })
})

describe('useTheme — toggle compat shim', () => {
  it('toggle flips light → dark', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('light')
    act(() => result.current.toggle())
    expect(result.current.mode).toBe('dark')
    expect(result.current.theme).toBe('dark')
  })

  it('toggle flips dark → light', () => {
    localStorage.setItem('wf_prefs', JSON.stringify({ mode: 'dark' }))
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('dark')
    act(() => result.current.toggle())
    expect(result.current.mode).toBe('light')
  })
})

// ===== NEW TESTS (08-03 B2 rewire) =====

describe('useTheme — wf_prefs precedence over legacy (new)', () => {
  it('wf_prefs.mode wins when both wf_prefs and legacy theme are set', () => {
    localStorage.setItem('wf_prefs', JSON.stringify({ mode: 'dark' }))
    localStorage.setItem('theme', 'light')
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('dark')
  })
})

describe('useTheme — legacy theme key one-shot migration (new)', () => {
  it('migrates legacy localStorage.theme=dark → wf_prefs.mode=dark and deletes legacy key', () => {
    localStorage.setItem('theme', 'dark')
    // wf_prefs is absent
    expect(localStorage.getItem('wf_prefs')).toBeNull()

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.mode).toBe('dark')
    // Legacy key removed
    expect(localStorage.getItem('theme')).toBeNull()
    // wf_prefs now contains mode
    const raw = localStorage.getItem('wf_prefs')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string).mode).toBe('dark')
  })
})

describe('useTheme — setMode never rewrites legacy theme key (new)', () => {
  it("setMode('dark') writes wf_prefs and queueSync, leaves localStorage.theme null", () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setMode('dark'))

    expect(localStorage.getItem('theme')).toBeNull()
    expect(JSON.parse(localStorage.getItem('wf_prefs') as string).mode).toBe('dark')
    expect(hoisted.state.calls.length).toBe(1)
    expect(hoisted.state.calls[0]?.[0]).toEqual({ mode: 'dark' })
  })

  it("setMode('dark') after a spied localStorage.setItem still never touches 'theme'", () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setMode('dark'))
    const themeWrites = spy.mock.calls.filter((c) => c[0] === 'theme')
    expect(themeWrites.length).toBe(0)
    spy.mockRestore()
  })
})

describe('useTheme — bootstrap hydration (new)', () => {
  it("onHydrated({ mode: 'dark' }) flips state and data-theme attribute", () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('light')
    expect(hoisted.state.onHydrated).not.toBeNull()

    act(() => {
      hoisted.state.onHydrated?.({ mode: 'dark' })
    })

    expect(result.current.mode).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
