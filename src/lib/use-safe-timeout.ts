'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * setTimeout wrapper that registers timers in a ref and clears all
 * outstanding timers on unmount. Drop-in replacement: returns the same
 * timer ID type as setTimeout.
 *
 * Usage:
 *   const safeSetTimeout = useSafeTimeout()
 *   safeSetTimeout(() => doThing(), 700)
 */
export function useSafeTimeout() {
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  return useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id)
      fn()
    }, ms)
    timersRef.current.add(id)
    return id
  }, [])
}
