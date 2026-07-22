import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Node 22 ships an experimental global `localStorage` that is non-functional
// without --localstorage-file; it shadows jsdom's implementation so bare
// `localStorage` reads as undefined in tests. Replace it with a simple
// in-memory Storage so the theme/lang/preferences suites run.
const memStore = new Map<string, string>()
const memLocalStorage: Storage = {
  get length() { return memStore.size },
  clear: () => memStore.clear(),
  getItem: (k) => (memStore.has(k) ? memStore.get(k)! : null),
  key: (i) => Array.from(memStore.keys())[i] ?? null,
  removeItem: (k) => { memStore.delete(k) },
  setItem: (k, v) => { memStore.set(k, String(v)) },
}
Object.defineProperty(globalThis, 'localStorage', { value: memLocalStorage, configurable: true, writable: true })
Object.defineProperty(window, 'localStorage', { value: memLocalStorage, configurable: true, writable: true })

afterEach(() => {
  cleanup()
})

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

// jsdom 29 lacks matchMedia; ThemeProvider.useEffect calls it. Polyfill to 'no match' default.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
