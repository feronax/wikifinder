'use client'

import { useEffect, useState } from 'react'

// Client: reads document.cookie on mount. Returns false on SSR/first render
// to keep hydration stable; flips to real value after mount.
export function useNewDesignFlag(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const match = document.cookie.match(/(?:^|; )wf_new_design=([01])/)
    setOn(match?.[1] === '1')
  }, [])
  return on
}
