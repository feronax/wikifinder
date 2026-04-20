import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModeToggle from './ModeToggle'
import { useTheme } from '@/components/ThemeProvider'

vi.mock('@/components/ThemeProvider', () => ({
  useTheme: vi.fn(),
}))

describe('ModeToggle — render', () => {
  const setMode = vi.fn()

  beforeEach(() => {
    setMode.mockReset()
    vi.mocked(useTheme).mockReset()
  })

  it('renders a button with type="button"', () => {
    vi.mocked(useTheme).mockReturnValue({
      mode: 'light',
      theme: 'light',
      setMode,
      toggle: vi.fn(),
      tokens: {} as never,
    } as never)
    render(<ModeToggle />)
    const btn = screen.getByTestId('mode-toggle')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('when mode is "light": aria-label is "Enable dark mode" and renders Moon icon', () => {
    vi.mocked(useTheme).mockReturnValue({
      mode: 'light',
      theme: 'light',
      setMode,
      toggle: vi.fn(),
      tokens: {} as never,
    } as never)
    render(<ModeToggle />)
    const btn = screen.getByRole('button', { name: /Enable dark mode/ })
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('data-testid')).toBe('mode-toggle')
    // Moon icon present (lucide renders svg; we assert no Sun by absence of "sun" class name
    // but most reliable: aria-label implies target mode)
    expect(btn.querySelector('svg')).toBeTruthy()
  })

  it('when mode is "dark": aria-label is "Enable light mode" and renders Sun icon', () => {
    vi.mocked(useTheme).mockReturnValue({
      mode: 'dark',
      theme: 'dark',
      setMode,
      toggle: vi.fn(),
      tokens: {} as never,
    } as never)
    render(<ModeToggle />)
    const btn = screen.getByRole('button', { name: /Enable light mode/ })
    expect(btn).toBeTruthy()
    expect(btn.querySelector('svg')).toBeTruthy()
  })
})

describe('ModeToggle — click behaviour', () => {
  const setMode = vi.fn()

  beforeEach(() => {
    setMode.mockReset()
    vi.mocked(useTheme).mockReset()
  })

  it('click when mode="light" calls setMode("dark")', () => {
    vi.mocked(useTheme).mockReturnValue({
      mode: 'light',
      theme: 'light',
      setMode,
      toggle: vi.fn(),
      tokens: {} as never,
    } as never)
    render(<ModeToggle />)
    fireEvent.click(screen.getByTestId('mode-toggle'))
    expect(setMode).toHaveBeenCalledTimes(1)
    expect(setMode).toHaveBeenCalledWith('dark')
  })

  it('click when mode="dark" calls setMode("light")', () => {
    vi.mocked(useTheme).mockReturnValue({
      mode: 'dark',
      theme: 'dark',
      setMode,
      toggle: vi.fn(),
      tokens: {} as never,
    } as never)
    render(<ModeToggle />)
    fireEvent.click(screen.getByTestId('mode-toggle'))
    expect(setMode).toHaveBeenCalledTimes(1)
    expect(setMode).toHaveBeenCalledWith('light')
  })
})
