import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Header from './Header'
import { useNewDesignFlag } from '@/lib/feature-flags-client'
import { useTheme } from './ThemeProvider'

vi.mock('@/lib/feature-flags-client', () => ({
  useNewDesignFlag: vi.fn(),
}))

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

describe('Header — flag OFF (legacy render, W2 regression)', () => {
  beforeEach(() => {
    vi.mocked(useNewDesignFlag).mockReturnValue(false)
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

  it('renders legacy FR and EN pill buttons', () => {
    render(<Header lang='fr' onLangChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^fr$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^en$/i })).toBeTruthy()
  })

  it('renders the legacy emoji theme-toggle button (🌙 when mode=light)', () => {
    render(<Header lang='fr' onLangChange={vi.fn()} />)
    const emojiBtn = screen.getByRole('button', { name: /🌙/ })
    expect(emojiBtn).toBeTruthy()
  })

  it('does NOT render the new <ModeToggle /> testid', () => {
    render(<Header lang='fr' onLangChange={vi.fn()} />)
    expect(screen.queryByTestId('mode-toggle')).toBeNull()
  })
})

describe('Header — flag ON (new design)', () => {
  beforeEach(() => {
    vi.mocked(useNewDesignFlag).mockReturnValue(true)
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
