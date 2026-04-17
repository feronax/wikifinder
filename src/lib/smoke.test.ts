import { describe, it, expect } from 'vitest'

describe('test infrastructure smoke', () => {
  it('runs Vitest with jsdom + module-load-time stubs wired', () => {
    expect(1 + 1).toBe(2)
  })
})
