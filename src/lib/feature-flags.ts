import { useEffect, useState } from 'react'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'wf_new_design'
const ENV_VAR = 'WF_NEW_DESIGN'

// Server: reads env first (authoritative on the server), cookie as fallback
// so the ?wf_new_design=1 query-override path (written to the cookie by proxy)
// flips the server render in the same request (D-11a + Q1/A5).
export async function isNewDesignEnabled(): Promise<boolean> {
  if (process.env[ENV_VAR] === '1') return true
  const jar = await cookies()
  return jar.get(COOKIE_NAME)?.value === '1'
}

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
