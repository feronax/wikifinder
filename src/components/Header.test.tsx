import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Header from './Header'
import { useTheme } from './ThemeProvider'

// Phase 13 / Plan 06 — POL-05 flag-flip: useNewDesignFlag mocking removed.
// New design is now the only render path; tests reflect the post-purge surface.

vi.mock('./ThemeProvider', () => ({
  useTheme: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
      signOut: () => Promise.resolve(),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
    }),
  }),
}))

vi.mock('@/lib/utils', () => ({
  useIsMobile: () => false,
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/game',
}))

describe('Header — new design (post-flag-flip)', () => {
  beforeEach(() => {
    vi.mocked(useTheme).mockReturnValue({
      mode: 'light',
      theme: 'light',
      setMode: vi.fn(),
      toggle: vi.fn(),
      tokens: {} as never,
    } as never)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders <ModeToggle /> (by data-testid)', () => {
    render(<Header lang='fr' onLangChange={vi.fn()} />)
    expect(screen.getByTestId('mode-toggle')).toBeTruthy()
  })

  it('does NOT render legacy FR/EN pill buttons', () => {
    render(<Header lang='fr' onLangChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^fr$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^en$/i })).toBeNull()
  })

  it('does NOT render the legacy emoji theme-toggle button', () => {
    render(<Header lang='fr' onLangChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /🌙|☀️/ })).toBeNull()
  })
})
