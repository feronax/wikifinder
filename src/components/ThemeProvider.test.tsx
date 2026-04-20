import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import ThemeProvider, { useTheme } from './ThemeProvider'
import { tokens as tokensData } from '@/lib/design/tokens'

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

function clearFlagCookie() {
  document.cookie = 'wf_new_design=; path=/; max-age=0'
}

function setFlagCookie(v: '0' | '1') {
  document.cookie = `wf_new_design=${v}; path=/`
}

describe('useTheme — default mode', () => {
  beforeEach(() => {
    localStorage.clear()
    clearFlagCookie()
    document.documentElement.removeAttribute('data-theme')
  })

  it('defaults to light when no localStorage, no flag cookie, no system preference', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('light')
    expect(result.current.theme).toBe('light')
    expect(result.current.tokens).toBe(tokensData.light)
  })

  it('defaults to dark when wf_new_design cookie is 1 (D-05a)', () => {
    setFlagCookie('1')
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('dark')
    expect(result.current.theme).toBe('dark')
    expect(result.current.tokens).toBe(tokensData.dark)
  })

  it('defaults to light when wf_new_design cookie is 0 (flag off)', () => {
    setFlagCookie('0')
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('light')
  })

  it('respects localStorage saved value over flag cookie', () => {
    localStorage.setItem('theme', 'light')
    setFlagCookie('1')
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('light')
  })
})

describe('useTheme — setMode', () => {
  beforeEach(() => {
    localStorage.clear()
    clearFlagCookie()
    document.documentElement.removeAttribute('data-theme')
  })

  it('setMode("dark") updates state, DOM attribute, localStorage, and tokens', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setMode('dark'))
    expect(result.current.mode).toBe('dark')
    expect(result.current.theme).toBe('dark')
    expect(result.current.tokens).toBe(tokensData.dark)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('setMode("light") reverses setMode("dark")', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setMode('dark'))
    act(() => result.current.setMode('light'))
    expect(result.current.mode).toBe('light')
    expect(result.current.tokens).toBe(tokensData.light)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

describe('useTheme — toggle compat shim', () => {
  beforeEach(() => {
    localStorage.clear()
    clearFlagCookie()
    document.documentElement.removeAttribute('data-theme')
  })

  it('toggle flips light → dark', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('light')
    act(() => result.current.toggle())
    expect(result.current.mode).toBe('dark')
    expect(result.current.theme).toBe('dark')
  })

  it('toggle flips dark → light', () => {
    setFlagCookie('1')
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('dark')
    act(() => result.current.toggle())
    expect(result.current.mode).toBe('light')
  })
})
