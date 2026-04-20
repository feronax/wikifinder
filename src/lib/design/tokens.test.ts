import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tokens, type Theme } from './tokens'
import { renderCss } from './generator-shared'

const GENERATED_PATH = resolve(__dirname, '../../app/design-tokens.generated.css')
const generatedCss = readFileSync(GENERATED_PATH, 'utf8')

function toKebab(s: string) {
  return s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
}

// jsdom normalizes CSS font-family values: single quotes → double quotes and
// strips whitespace after commas. Normalize both sides before comparison so
// intent (font fallback order) is what's asserted, not stylistic differences.
function normalizeCssValue(v: string) {
  return v.trim().replace(/'/g, '"').replace(/,\s+/g, ',')
}

describe('design tokens — generator drift', () => {
  it('committed design-tokens.generated.css matches renderCss(tokens) byte-for-byte', () => {
    expect(renderCss(tokens)).toBe(generatedCss)
  })
})

describe('design tokens — jsdom resolution', () => {
  beforeAll(() => {
    const style = document.createElement('style')
    style.textContent = generatedCss
    document.head.appendChild(style)
  })

  for (const mode of ['dark', 'light'] as const satisfies readonly Theme[]) {
    it(`resolves all 18 --wf-* vars for ${mode} theme`, () => {
      document.documentElement.setAttribute('data-theme', mode)
      const probe = document.createElement('div')
      document.body.appendChild(probe)
      const computed = getComputedStyle(probe)
      const set = tokens[mode]
      for (const [key, expected] of Object.entries(set)) {
        const cssVar = '--wf-' + toKebab(key)
        expect(normalizeCssValue(computed.getPropertyValue(cssVar))).toBe(
          normalizeCssValue(expected),
        )
      }
      probe.remove()
    })
  }
})
