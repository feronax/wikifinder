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
    radius: '8px',
    radiusCard: '12px',
    fontHead: "'Geist', 'Inter', system-ui, sans-serif",
    fontBody: "'Geist', 'Inter', system-ui, sans-serif",
    fontUi: "'Geist', 'Inter', system-ui, sans-serif",
    // minimal-amber uses Geist for article body (matches design-proto app.jsx minimal theme).
    // Previously Source Serif 4 diverged from mockup; proto treats fontHead === fontBody === fontArticle in minimal.
    fontArticle: "'Geist', 'Inter', system-ui, sans-serif",
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
    radius: '8px',
    radiusCard: '12px',
    fontHead: "'Geist', 'Inter', system-ui, sans-serif",
    fontBody: "'Geist', 'Inter', system-ui, sans-serif",
    fontUi: "'Geist', 'Inter', system-ui, sans-serif",
    // minimal-amber: Geist for article body (matches design-proto minimal theme).
    fontArticle: "'Geist', 'Inter', system-ui, sans-serif",
    density: '1',
  },
}
