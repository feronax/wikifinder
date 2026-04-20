import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tokens } from '../src/lib/design/tokens'
import { renderCss } from '../src/lib/design/generator-shared'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'src/app/design-tokens.generated.css')

writeFileSync(outPath, renderCss(tokens), 'utf8')
console.log('[tokens] wrote src/app/design-tokens.generated.css')
