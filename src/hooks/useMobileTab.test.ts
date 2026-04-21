import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMobileTab } from './useMobileTab'

describe('useMobileTab', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.sessionStorage.clear()
  })

  it("returns { activeTab: 'jeu', setActiveTab: <fn> } on first render with empty sessionStorage", () => {
    const { result } = renderHook(() => useMobileTab('p1'))
    expect(result.current.activeTab).toBe('jeu')
    expect(typeof result.current.setActiveTab).toBe('function')
  })

  it("hydrates from sessionStorage on mount when wf_mobile_tab_p1 holds 'mots'", () => {
    window.sessionStorage.setItem('wf_mobile_tab_p1', 'mots')
    const { result } = renderHook(() => useMobileTab('p1'))
    expect(result.current.activeTab).toBe('mots')
  })

  it("writes 'stats' to sessionStorage key wf_mobile_tab_p1 when setActiveTab('stats') called", () => {
    const { result } = renderHook(() => useMobileTab('p1'))
    act(() => {
      result.current.setActiveTab('stats')
    })
    expect(window.sessionStorage.getItem('wf_mobile_tab_p1')).toBe('stats')
    expect(result.current.activeTab).toBe('stats')
  })

  it("ignores invalid stored values — sessionStorage holding 'garbage' yields default 'jeu'", () => {
    window.sessionStorage.setItem('wf_mobile_tab_p1', 'garbage')
    const { result } = renderHook(() => useMobileTab('p1'))
    expect(result.current.activeTab).toBe('jeu')
  })

  it('gracefully no-ops on sessionStorage.setItem throw (iOS private mode); state still updates locally', () => {
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })

    const { result } = renderHook(() => useMobileTab('p1'))

    expect(() => {
      act(() => {
        result.current.setActiveTab('mots')
      })
    }).not.toThrow()

    expect(result.current.activeTab).toBe('mots')
  })

  it('when pageId is null, setActiveTab updates local state but does NOT call sessionStorage.setItem', () => {
    const setItemSpy = vi.spyOn(window.sessionStorage, 'setItem')

    const { result } = renderHook(() => useMobileTab(null))
    act(() => {
      result.current.setActiveTab('stats')
    })

    expect(result.current.activeTab).toBe('stats')
    expect(setItemSpy).not.toHaveBeenCalled()
  })
})
