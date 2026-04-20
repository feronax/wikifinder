import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import LangProvider, { useLang } from './LangProvider'
import type { Preferences } from '@/lib/preferences'

const hoisted = vi.hoisted(() => {
  const queueSync = Object.assign(
    (_patch: Partial<Preferences>, _userId: string | null) => {},
    { debounceArmed: () => false },
  )
  const queueSyncFn = Object.assign((patch: Partial<Preferences>, userId: string | null) => {
    calls.push([patch, userId])
  }, { debounceArmed: () => false })
  const calls: Array<[Partial<Preferences>, string | null]> = []
  const state = {
    onHydrated: null as null | ((remote: Preferences) => void),
    bootstrapCalls: 0,
    calls,
    queueSync,
  }
  return { state, queueSyncFn }
})

vi.mock('@/lib/preferences', () => {
  const STORAGE_KEY = 'wf_prefs'
  function loadLocalPrefs(): Preferences {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed as Preferences
      return {}
    } catch {
      return {}
    }
  }
  function saveLocalPrefs(patch: Partial<Preferences>): void {
    if (typeof localStorage === 'undefined') return
    const current = loadLocalPrefs()
    const merged = { ...current, ...patch }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  }
  function usePreferenceSync() {
    return hoisted.queueSyncFn
  }
  function usePreferencesBootstrap(params: {
    userIdRef: MutableRefObject<string | null>
    queueSync: typeof hoisted.queueSyncFn
    onHydrated: (remote: Preferences) => void
  }) {
    hoisted.state.bootstrapCalls += 1
    hoisted.state.onHydrated = params.onHydrated
  }
  return {
    loadLocalPrefs,
    saveLocalPrefs,
    usePreferenceSync,
    usePreferencesBootstrap,
  }
})

function clearLangCookie() {
  document.cookie = 'wf_lang=; Path=/; Max-Age=0'
}

function getLangCookie(): string | null {
  const match = document.cookie.match(/(?:^|; )wf_lang=(fr|en)/)
  return match?.[1] ?? null
}

function wrapper({ children, initialLang }: { children: React.ReactNode; initialLang?: 'fr' | 'en' }) {
  return <LangProvider initialLang={initialLang}>{children}</LangProvider>
}

beforeEach(() => {
  localStorage.clear()
  clearLangCookie()
  hoisted.state.onHydrated = null
  hoisted.state.bootstrapCalls = 0
  hoisted.state.calls.length = 0
})

describe('useLang — initial value', () => {
  it("defaults to 'fr' when no initialLang, no localStorage, no cookie", () => {
    const { result } = renderHook(() => useLang(), {
      wrapper: ({ children }) => wrapper({ children }),
    })
    expect(result.current.lang).toBe('fr')
  })

  it("respects initialLang='en' on first render", () => {
    const { result } = renderHook(() => useLang(), {
      wrapper: ({ children }) => wrapper({ children, initialLang: 'en' }),
    })
    expect(result.current.lang).toBe('en')
  })

  it("localStorage wf_prefs.lang='en' wins over initialLang='fr' after mount effect", () => {
    localStorage.setItem('wf_prefs', JSON.stringify({ lang: 'en' }))
    const { result } = renderHook(() => useLang(), {
      wrapper: ({ children }) => wrapper({ children, initialLang: 'fr' }),
    })
    expect(result.current.lang).toBe('en')
  })

  it('bootstrap hook is invoked once on mount', () => {
    renderHook(() => useLang(), { wrapper: ({ children }) => wrapper({ children }) })
    expect(hoisted.state.bootstrapCalls).toBe(1)
  })
})

describe('useLang — setLang', () => {
  it("setLang('en') updates state, localStorage, cookie, and queues sync", () => {
    const { result } = renderHook(() => useLang(), {
      wrapper: ({ children }) => wrapper({ children, initialLang: 'fr' }),
    })
    act(() => result.current.setLang('en'))

    expect(result.current.lang).toBe('en')
    const raw = localStorage.getItem('wf_prefs')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string).lang).toBe('en')
    expect(getLangCookie()).toBe('en')
    expect(hoisted.state.calls.length).toBe(1)
    expect(hoisted.state.calls[0]?.[0]).toEqual({ lang: 'en' })
  })

  it("setLang('fr') writes cookie", () => {
    const { result } = renderHook(() => useLang(), {
      wrapper: ({ children }) => wrapper({ children, initialLang: 'en' }),
    })
    act(() => result.current.setLang('fr'))
    expect(getLangCookie()).toBe('fr')
  })
})

describe('useLang — bootstrap hydration', () => {
  it("bootstrap onHydrated({ lang: 'en' }) flips state + writes cookie", () => {
    const { result } = renderHook(() => useLang(), {
      wrapper: ({ children }) => wrapper({ children, initialLang: 'fr' }),
    })
    expect(result.current.lang).toBe('fr')
    expect(hoisted.state.onHydrated).not.toBeNull()

    act(() => {
      hoisted.state.onHydrated?.({ lang: 'en' })
    })

    expect(result.current.lang).toBe('en')
    expect(getLangCookie()).toBe('en')
  })

  it('bootstrap onHydrated with no lang key is ignored for lang state', () => {
    const { result } = renderHook(() => useLang(), {
      wrapper: ({ children }) => wrapper({ children, initialLang: 'fr' }),
    })
    act(() => {
      hoisted.state.onHydrated?.({ mode: 'dark' })
    })
    expect(result.current.lang).toBe('fr')
  })
})

describe('useLang — URL ?lang= does NOT drive provider (D-10a)', () => {
  it('ignores window.location.search', () => {
    const originalSearch = window.location.search
    try {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, search: '?lang=en' },
      })
      const { result } = renderHook(() => useLang(), {
        wrapper: ({ children }) => wrapper({ children, initialLang: 'fr' }),
      })
      expect(result.current.lang).toBe('fr')
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, search: originalSearch },
      })
    }
  })
})
