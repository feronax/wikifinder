import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase server client; tests inject behavior per case
const mockGetUser = vi.fn()
const mockUpsert = vi.fn()
const mockDeleteEq2 = vi.fn()
const mockDeleteEq1 = vi.fn(() => ({ eq: mockDeleteEq2 }))
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq1 }))
const mockFrom = vi.fn(() => ({
  upsert: mockUpsert,
  delete: mockDelete,
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

import { POST, DELETE } from './route'

function makeReq(body: unknown, method = 'POST'): Request {
  return new Request('http://x/api/follows', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockGetUser.mockReset()
  mockUpsert.mockReset()
  mockDelete.mockClear()
  mockDeleteEq1.mockClear()
  mockDeleteEq2.mockReset()
  mockUpsert.mockResolvedValue({ data: null, error: null })
  mockDeleteEq2.mockResolvedValue({ data: null, error: null })
})

describe('POST /api/follows', () => {
  it('returns 401 when not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeReq({ followeeId: '00000000-0000-4000-8000-000000000000' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 on malformed body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '00000000-0000-4000-8000-000000000001' } } })
    const res = await POST(makeReq({ followeeId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 on self-follow (D-04)', async () => {
    const me = '00000000-0000-4000-8000-000000000001'
    mockGetUser.mockResolvedValue({ data: { user: { id: me } } })
    const res = await POST(makeReq({ followeeId: me }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/toi-même|yourself/i)
  })

  it('returns 200 on successful upsert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '00000000-0000-4000-8000-000000000001' } } })
    const res = await POST(makeReq({ followeeId: '00000000-0000-4000-8000-000000000002' }))
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalled()
  })
})

describe('DELETE /api/follows', () => {
  it('returns 401 when not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await DELETE(makeReq({ followeeId: '00000000-0000-4000-8000-000000000002' }, 'DELETE'))
    expect(res.status).toBe(401)
  })

  it('returns 200 even when no row was deleted (D-05 idempotency)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '00000000-0000-4000-8000-000000000001' } } })
    const res = await DELETE(makeReq({ followeeId: '00000000-0000-4000-8000-000000000002' }, 'DELETE'))
    expect(res.status).toBe(200)
  })
})
