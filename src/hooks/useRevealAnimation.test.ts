import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRevealAnimation } from './useRevealAnimation'

type MQL = {
  matches: boolean
  media: string
  onchange: null
  addListener: () => void
  removeListener: () => void
  addEventListener: () => void
  removeEventListener: () => void
  dispatchEvent: () => boolean
}

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((query: string): MQL => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  })
}

describe('useRevealAnimation', () => {
  let scrollSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    scrollSpy = vi.fn()
    // Spy on Element.prototype.scrollIntoView (jsdom doesn't implement it)
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      writable: true,
      configurable: true,
      value: scrollSpy,
    })
    stubMatchMedia(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('trigger sets justRevealed, then clears to null at +1100ms', () => {
    const { result } = renderHook(() => useRevealAnimation())
    document.body.innerHTML = '<span data-word="pomme"></span>'

    expect(result.current.justRevealed).toBeNull()

    act(() => {
      result.current.trigger('pomme')
    })
    expect(result.current.justRevealed).toBe('pomme')

    act(() => {
      vi.advanceTimersByTime(1099)
    })
    expect(result.current.justRevealed).toBe('pomme')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.justRevealed).toBeNull()
  })

  it('calls scrollIntoView on first [data-word] node at +80ms with smooth behavior', () => {
    const { result } = renderHook(() => useRevealAnimation())
    document.body.innerHTML =
      '<span data-word="pomme" id="first"></span>' +
      '<span data-word="pomme" id="second"></span>'

    act(() => {
      result.current.trigger('pomme')
    })

    // Not yet
    expect(scrollSpy).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(80)
    })

    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    // Called on the FIRST occurrence in document order
    expect(scrollSpy.mock.instances[0]).toBe(document.getElementById('first'))
  })

  it('honors prefers-reduced-motion: uses behavior "auto"', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useRevealAnimation())
    document.body.innerHTML = '<span data-word="pomme"></span>'

    act(() => {
      result.current.trigger('pomme')
    })
    act(() => {
      vi.advanceTimersByTime(80)
    })

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' })
  })

  it('unmounting before 1100ms does not leak timers or warn about state updates', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result, unmount } = renderHook(() => useRevealAnimation())
    document.body.innerHTML = '<span data-word="pomme"></span>'

    act(() => {
      result.current.trigger('pomme')
    })

    unmount()

    // Advance past both timers — no callbacks should fire on the unmounted hook
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(consoleError).not.toHaveBeenCalled()
    // No pending timers remain
    expect(vi.getTimerCount()).toBe(0)
    consoleError.mockRestore()
  })

  it('multiple calls: second trigger wins; both scroll calls happen at correct offsets', () => {
    const { result } = renderHook(() => useRevealAnimation())
    document.body.innerHTML =
      '<span data-word="alpha" id="a"></span>' +
      '<span data-word="beta" id="b"></span>'

    act(() => {
      result.current.trigger('alpha')
    })
    act(() => {
      vi.advanceTimersByTime(80)
    })
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(scrollSpy.mock.instances[0]).toBe(document.getElementById('a'))

    // 200ms after first trigger — fire second
    act(() => {
      vi.advanceTimersByTime(120) // now at +200ms since first trigger
      result.current.trigger('beta')
    })
    act(() => {
      vi.advanceTimersByTime(80)
    })
    expect(scrollSpy).toHaveBeenCalledTimes(2)
    expect(scrollSpy.mock.instances[1]).toBe(document.getElementById('b'))

    // Final state is the second word
    expect(result.current.justRevealed).toBe('beta')
  })
})
