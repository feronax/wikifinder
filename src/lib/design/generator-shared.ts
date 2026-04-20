import type { TokenSet } from './tokens'

function toKebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
}

function renderBlock(selector: string, set: TokenSet): string {
  const lines = Object.entries(set).map(
    ([k, v]) => `  --wf-${toKebab(k)}: ${v};`,
  )
  return `${selector} {\n${lines.join('\n')}\n}`
}

export function renderCss(tokens: { dark: TokenSet; light: TokenSet }): string {
  const header = '/* GENERATED FILE — do not edit. Source: src/lib/design/tokens.ts */'
  const dark = renderBlock('[data-theme="dark"]', tokens.dark)
  const light = renderBlock('[data-theme="light"]', tokens.light)
  return `${header}\n\n${dark}\n\n${light}\n`
}
