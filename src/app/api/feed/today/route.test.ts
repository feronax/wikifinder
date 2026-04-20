import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()

// Chainable mock builder for supabase query chains
function makeChain(finalResponse: any) {
  const chain: any = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => Promise.resolve(finalResponse))
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  // For count queries (chain returns promise when awaited)
  chain.then = undefined
  return chain
}

let feedChain: any
let profileChain: any
let countChain: any

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') return profileChain
      if (table === 'follows') {
        // The route calls follows twice: once for feed (uses .limit), once for count (awaited directly)
        const first = feedChain
        feedChain = countChain
        return first
      }
      return feedChain
    }),
  }),
}))

import { GET } from './route'

beforeEach(() => {
  mockGetUser.mockReset()
  feedChain = makeChain({ data: [], error: null })
  profileChain = makeChain({ data: null, error: null })
  profileChain.maybeSingle = vi.fn(() => Promise.resolve({ data: { lang_pref: 'fr' }, error: null }))
  // countChain: .select returns self, .eq returns a thenable resolving to { count, error }
  countChain = {
    select: vi.fn(() => countChain),
    eq: vi.fn(() => Promise.resolve({ count: 0, error: null })),
  }
})

describe('GET /api/feed/today', () => {
  it('returns 401 when not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(new Request('http://x/api/feed/today'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with empty entries and numeric followCount when no follows exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '00000000-0000-4000-8000-000000000001' } } })
    const res = await GET(new Request('http://x/api/feed/today'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.entries).toEqual([])
    expect(typeof body.followCount).toBe('number')
  })

  it('sets Cache-Control: private, max-age=30 (D-10)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '00000000-0000-4000-8000-000000000001' } } })
    const res = await GET(new Request('http://x/api/feed/today'))
    expect(res.headers.get('cache-control')).toMatch(/private.*max-age=30/)
  })

  it('returns 200 with empty entries on embed query error (graceful degradation)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '00000000-0000-4000-8000-000000000001' } } })
    feedChain = makeChain({ data: null, error: { message: 'embed failed' } })
    const res = await GET(new Request('http://x/api/feed/today'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.entries).toEqual([])
    expect(body.followCount).toBe(0)
    expect(res.headers.get('cache-control')).toMatch(/private.*max-age=30/)
  })
})
