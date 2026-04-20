import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

// Mock next/headers.cookies() — returns a jar whose `.get()` is controllable per test.
const mockCookieGet = vi.fn<(name: string) => { value: string } | undefined>()
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: mockCookieGet }),
}))

// Import AFTER mock registration
import { isNewDesignEnabled } from './feature-flags'

describe('isNewDesignEnabled', () => {
  const originalEnv = process.env.WF_NEW_DESIGN

  beforeEach(() => {
    mockCookieGet.mockReset()
    delete process.env.WF_NEW_DESIGN
  })

  afterAll(() => {
    if (originalEnv === undefined) delete process.env.WF_NEW_DESIGN
    else process.env.WF_NEW_DESIGN = originalEnv
  })

  it("returns true when env WF_NEW_DESIGN='1' (ignores cookie)", async () => {
    process.env.WF_NEW_DESIGN = '1'
    mockCookieGet.mockReturnValue({ value: '0' })
    expect(await isNewDesignEnabled()).toBe(true)
  })

  it("returns true when env='0' but cookie='1' (query-override path)", async () => {
    process.env.WF_NEW_DESIGN = '0'
    mockCookieGet.mockReturnValue({ value: '1' })
    expect(await isNewDesignEnabled()).toBe(true)
  })

  it("returns false when env='0' and cookie='0'", async () => {
    process.env.WF_NEW_DESIGN = '0'
    mockCookieGet.mockReturnValue({ value: '0' })
    expect(await isNewDesignEnabled()).toBe(false)
  })

  it('returns false when env unset and cookie missing', async () => {
    mockCookieGet.mockReturnValue(undefined)
    expect(await isNewDesignEnabled()).toBe(false)
  })

  it('returns false when cookie value is malformed', async () => {
    mockCookieGet.mockReturnValue({ value: 'garbage' })
    expect(await isNewDesignEnabled()).toBe(false)
  })
})
