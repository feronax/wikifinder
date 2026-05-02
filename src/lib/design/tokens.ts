export type Theme = 'light' | 'dark'

export type TokenSet = {
  // mode-specific colors (10)
  bg: string
  bg2: string
  surface: string
  border: string
  borderStrong: string
  ink: string
  muted: string
  faint: string
  mask: string
  maskEdge: string
  // direction invariants (duplicated across dark+light, 8)
  accent: string
  accentInk: string
  accentTextOnLight: string
  radius: string
  radiusCard: string
  fontHead: string
  fontBody: string
  fontUi: string
  fontArticle: string
  // forward-compat (v1.2 multi-direction)
  density: string
}

export const tokens: { dark: TokenSet; light: TokenSet } = {
  dark: {
    bg: '#0a0a0b',
    bg2: '#111113',
    surface: '#17171a',
    border: '#26262b',
    borderStrong: '#3a3a42',
    ink: '#ededee',
    muted: '#9a9aa3',
    faint: '#5f5f68',
    mask: '#1f1f23',
    maskEdge: '#2d2d33',
    accent: '#f59e0b',
    accentInk: '#1a0f00',
    accentTextOnLight: '#f59e0b',
    radius: '8px',
    radiusCard: '12px',
    fontHead: "'Geist', 'Inter', system-ui, sans-serif",
    fontBody: "'Geist', 'Inter', system-ui, sans-serif",
    fontUi: "'Geist', 'Inter', system-ui, sans-serif",
    // design/DESIGN-HANDOFF.md §Typography: article body stays in Source Serif 4 —
    // product signature (UI sans-serif / contenu serif, comme un journal).
    fontArticle: "'Source Serif 4', 'Source Serif Pro', Georgia, serif",
    density: '1',
  },
  light: {
    bg: '#fafafa',
    bg2: '#f2f2f3',
    surface: '#ffffff',
    border: '#e6e6e8',
    borderStrong: '#c8c8cc',
    ink: '#0a0a0b',
    muted: '#63636d',
    faint: '#9a9aa3',
    mask: '#d4d4d8',
    maskEdge: '#bfbfc5',
    accent: '#f59e0b',
    accentInk: '#1a0f00',
    accentTextOnLight: '#92400e',
    radius: '8px',
    radiusCard: '12px',
    fontHead: "'Geist', 'Inter', system-ui, sans-serif",
    fontBody: "'Geist', 'Inter', system-ui, sans-serif",
    fontUi: "'Geist', 'Inter', system-ui, sans-serif",
    // design/DESIGN-HANDOFF.md §Typography: article body stays in Source Serif 4.
    fontArticle: "'Source Serif 4', 'Source Serif Pro', Georgia, serif",
    density: '1',
  },
}
