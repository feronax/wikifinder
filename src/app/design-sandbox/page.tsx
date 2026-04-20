// TODO(Phase 13 / D-15): delete this route in the flag-flip PR.
import { notFound } from 'next/navigation'
import { isNewDesignEnabled } from '@/lib/feature-flags'
import DesignSandboxClient from './DesignSandboxClient'

// Force dynamic so env/cookie reads aren't cached across toggles.
export const dynamic = 'force-dynamic'

export default async function DesignSandboxPage() {
  if (!(await isNewDesignEnabled())) {
    notFound()
  }
  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: 24 }}>
      <DesignSandboxClient />
    </main>
  )
}
