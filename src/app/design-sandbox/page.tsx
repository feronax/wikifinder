// Phase 13 / Plan 06 — POL-05: flag-flip complete. The legacy gate via
// isNewDesignEnabled() is removed; the sandbox is now always available.
// (Route remains useful for token/component spot-checks across themes.)
import DesignSandboxClient from './DesignSandboxClient'

export default function DesignSandboxPage() {
  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: 24 }}>
      <DesignSandboxClient />
    </main>
  )
}
