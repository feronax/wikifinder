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
