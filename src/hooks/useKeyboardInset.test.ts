import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKeyboardInset } from './useKeyboardInset'

type VVStub = {
  height: number
  offsetTop: number
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

let vvListeners: Map<string, EventListener>
let vvStub: VVStub

function makeVVStub(height: number, offsetTop = 0): VVStub {
  vvListeners = new Map()
  return {
    height,
    offsetTop,
    addEventListener: vi.fn((evt: string, fn: EventListener) => {
      vvListeners.set(evt, fn)
    }),
    removeEventListener: vi.fn((evt: string) => {
      vvListeners.delete(evt)
    }),
  }
}

function installVV(stub: VVStub | undefined, innerHeight = 800) {
  Object.defineProperty(window, 'visualViewport', {
    writable: true,
    configurable: true,
    value: stub,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: innerHeight,
  })
}

describe('useKeyboardInset', () => {
  beforeEach(() => {
    vvListeners = new Map()
    vvStub = makeVVStub(800, 0)
    installVV(vvStub, 800)
    // rAF immediate-execute shim so the hook's rAF-throttled update runs synchronously
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 0
      },
    )
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    document.documentElement.style.removeProperty('--wf-kb-inset')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.style.removeProperty('--wf-kb-inset')
  })

  it('writes inset=0 with px suffix to --wf-kb-inset on mount when viewport height equals innerHeight', () => {
    renderHook(() => useKeyboardInset())
    expect(
      document.documentElement.style.getPropertyValue('--wf-kb-inset'),
    ).toBe('0px')
  })

  it('returns { inset: 0, isOpen: false } initially when visualViewport height matches innerHeight', () => {
    const { result } = renderHook(() => useKeyboardInset())
    expect(result.current.inset).toBe(0)
    expect(result.current.isOpen).toBe(false)
  })

  it('returns { inset: 200, isOpen: true } after resize with height=600 + offsetTop=0 + innerHeight=800', () => {
    const { result } = renderHook(() => useKeyboardInset())

    act(() => {
      vvStub.height = 600
      vvStub.offsetTop = 0
      const handler = vvListeners.get('resize')
      if (handler) handler(new Event('resize'))
    })

    expect(result.current.inset).toBe(200)
    expect(result.current.isOpen).toBe(true)
    expect(
      document.documentElement.style.getPropertyValue('--wf-kb-inset'),
    ).toBe('200px')
  })

  it('early-exits (no listeners, no CSS prop) when window.visualViewport is undefined (old WebView fallback)', () => {
    installVV(undefined, 800)
    renderHook(() => useKeyboardInset())

    // No listeners could be registered because vvStub.addEventListener was never
    // the target (visualViewport is undefined). Verify the CSS prop was not written.
    expect(
      document.documentElement.style.getPropertyValue('--wf-kb-inset'),
    ).toBe('')
  })

  it('removes the resize listener and clears --wf-kb-inset on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardInset())
    // Sanity: hook wired up listeners
    expect(vvListeners.size).toBeGreaterThan(0)

    unmount()

    expect(vvListeners.size).toBe(0)
    expect(
      document.documentElement.style.getPropertyValue('--wf-kb-inset'),
    ).toBe('')
  })
})
