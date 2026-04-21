import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOccurrenceCycle } from './useOccurrenceCycle'

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

function mountFixture(spec: Array<[string, number]>) {
  document.body.innerHTML = spec
    .flatMap(([word, count]) =>
      Array.from({ length: count }, (_, i) => `<span data-word="${word}" id="${word}-${i}"></span>`)
    )
    .join('')
}

describe('useOccurrenceCycle', () => {
  let scrollSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    scrollSpy = vi.fn()
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

  it('first click: cycle sets highlighted idx=0 and scrolls the first node', () => {
    const { result } = renderHook(() => useOccurrenceCycle())
    mountFixture([['pomme', 3]])

    expect(result.current.highlighted).toBeNull()

    act(() => {
      result.current.cycle('pomme')
    })

    expect(result.current.highlighted).toEqual({ word: 'pomme', idx: 0 })
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(scrollSpy.mock.instances[0]).toBe(document.getElementById('pomme-0'))
  })

  it('wrap-around: 4 consecutive cycles on 3 occurrences yield 0,1,2,0', () => {
    const { result } = renderHook(() => useOccurrenceCycle())
    mountFixture([['pomme', 3]])

    const seen: number[] = []
    for (let i = 0; i < 4; i++) {
      act(() => {
        result.current.cycle('pomme')
      })
      seen.push(result.current.highlighted!.idx)
      // Clear pulse timer between clicks so highlighted state isn't pre-cleared
      // mid-check — advance less than 500ms so setHighlighted(null) hasn't fired.
    }
    expect(seen).toEqual([0, 1, 2, 0])
  })

  it('cross-word reset: cycle(a) then cycle(b) then resetOthers(b) then cycle(a) restarts at idx=0', () => {
    const { result } = renderHook(() => useOccurrenceCycle())
    mountFixture([['alpha', 3], ['beta', 2]])

    // Advance alpha cursor to idx=1
    act(() => { result.current.cycle('alpha') })
    act(() => { result.current.cycle('alpha') })
    expect(result.current.highlighted).toEqual({ word: 'alpha', idx: 1 })

    // Move to beta
    act(() => { result.current.cycle('beta') })
    expect(result.current.highlighted).toEqual({ word: 'beta', idx: 0 })

    // Reset every other word's cursor (D-15 §4)
    act(() => { result.current.resetOthers('beta') })

    // Returning to alpha — cursor should be back at 0
    act(() => { result.current.cycle('alpha') })
    expect(result.current.highlighted).toEqual({ word: 'alpha', idx: 0 })
  })

  it('no nodes: cycle on a word with zero occurrences is a safe no-op', () => {
    const { result } = renderHook(() => useOccurrenceCycle())
    mountFixture([['pomme', 2]])

    expect(() => {
      act(() => {
        result.current.cycle('zzz')
      })
    }).not.toThrow()

    expect(result.current.highlighted).toBeNull()
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it('highlight clears at +500ms (pulse duration)', () => {
    const { result } = renderHook(() => useOccurrenceCycle())
    mountFixture([['pomme', 2]])

    act(() => {
      result.current.cycle('pomme')
    })
    expect(result.current.highlighted).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(result.current.highlighted).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.highlighted).toBeNull()
  })

  it('prefers-reduced-motion: scrollIntoView called with behavior="auto"', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useOccurrenceCycle())
    mountFixture([['pomme', 2]])

    act(() => {
      result.current.cycle('pomme')
    })

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' })
  })

  it('unmount cleanup: no pending timers leak', () => {
    const { result, unmount } = renderHook(() => useOccurrenceCycle())
    mountFixture([['pomme', 2]])

    act(() => {
      result.current.cycle('pomme')
    })

    unmount()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(vi.getTimerCount()).toBe(0)
  })
})
