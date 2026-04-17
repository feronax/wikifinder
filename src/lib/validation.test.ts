import { describe, it, expect } from 'vitest'
import {
  LangSchema,
  UuidSchema,
  DateSchema,
  GuessWordSchema,
  FeedbackMessageSchema,
  ScreenshotDataSchema,
  parseJsonBody,
  parseSearchParams,
} from '@/lib/validation'
import { z } from 'zod'

describe('LangSchema', () => {
  it("accepts 'fr'", () => {
    expect(LangSchema.safeParse('fr').success).toBe(true)
  })
  it("accepts 'en'", () => {
    expect(LangSchema.safeParse('en').success).toBe(true)
  })
  it("rejects 'de'", () => {
    expect(LangSchema.safeParse('de').success).toBe(false)
  })
  it('rejects empty string', () => {
    expect(LangSchema.safeParse('').success).toBe(false)
  })
})

describe('UuidSchema', () => {
  it('accepts crypto.randomUUID output', () => {
    const id = crypto.randomUUID()
    expect(UuidSchema.safeParse(id).success).toBe(true)
  })
  it('rejects non-UUID string', () => {
    expect(UuidSchema.safeParse('not-a-uuid').success).toBe(false)
  })
  it('rejects empty string', () => {
    expect(UuidSchema.safeParse('').success).toBe(false)
  })
})

describe('DateSchema', () => {
  it("accepts '2026-04-17'", () => {
    expect(DateSchema.safeParse('2026-04-17').success).toBe(true)
  })
  it("rejects unpadded '2026-4-17'", () => {
    expect(DateSchema.safeParse('2026-4-17').success).toBe(false)
  })
  it('rejects empty string', () => {
    expect(DateSchema.safeParse('').success).toBe(false)
  })
  it('rejects non-date string', () => {
    expect(DateSchema.safeParse('not-a-date').success).toBe(false)
  })
})

describe('GuessWordSchema', () => {
  it('trims whitespace and accepts simple word', () => {
    const r = GuessWordSchema.safeParse('  chat  ')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('chat')
  })
  it('rejects empty string', () => {
    expect(GuessWordSchema.safeParse('').success).toBe(false)
  })
  it('rejects whitespace-only string', () => {
    expect(GuessWordSchema.safeParse('   ').success).toBe(false)
  })
  it('accepts exactly 60 chars', () => {
    expect(GuessWordSchema.safeParse('a'.repeat(60)).success).toBe(true)
  })
  it('rejects 61+ chars', () => {
    expect(GuessWordSchema.safeParse('a'.repeat(61)).success).toBe(false)
  })
})

describe('FeedbackMessageSchema', () => {
  it('accepts a typical feedback body', () => {
    expect(FeedbackMessageSchema.safeParse('This app is great!').success).toBe(true)
  })
  it('rejects empty string after trim', () => {
    expect(FeedbackMessageSchema.safeParse('').success).toBe(false)
  })
  it('rejects 2001+ chars', () => {
    expect(FeedbackMessageSchema.safeParse('a'.repeat(2001)).success).toBe(false)
  })
})

describe('ScreenshotDataSchema', () => {
  it('accepts a small data URI string', () => {
    expect(ScreenshotDataSchema.safeParse('data:image/png;base64,AAAA').success).toBe(true)
  })
  it('rejects strings larger than the cap', () => {
    expect(ScreenshotDataSchema.safeParse('a'.repeat(6_500_001)).success).toBe(false)
  })
})

describe('parseJsonBody', () => {
  const schema = z.object({ x: z.number() })

  it('returns { data } for valid JSON matching schema', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ x: 1 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const r = await parseJsonBody(req, schema)
    expect('data' in r).toBe(true)
    if ('data' in r) expect(r.data.x).toBe(1)
  })

  it('returns { error } for malformed JSON', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const r = await parseJsonBody(req, schema)
    expect('error' in r).toBe(true)
  })

  it('returns { error } for JSON that fails schema', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ x: 'wrong-type' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const r = await parseJsonBody(req, schema)
    expect('error' in r).toBe(true)
  })
})

describe('parseSearchParams', () => {
  const schema = z.object({ lang: LangSchema })

  it('returns { data } for a valid query string', () => {
    const url = new URL('http://localhost/?lang=fr')
    const r = parseSearchParams(url, schema)
    expect('data' in r).toBe(true)
    if ('data' in r) expect(r.data.lang).toBe('fr')
  })

  it('returns { error } for an invalid query string', () => {
    const url = new URL('http://localhost/?lang=de')
    const r = parseSearchParams(url, schema)
    expect('error' in r).toBe(true)
  })

  it('returns { error } when a required param is missing', () => {
    const url = new URL('http://localhost/')
    const r = parseSearchParams(url, schema)
    expect('error' in r).toBe(true)
  })
})
