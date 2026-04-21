import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // Per-test timeout: the daily-game spec plays real guesses through the HARD-01
  // queue against live Supabase + Wiktionary. Each iteration averages ~5s wall-clock
  // (fill + press + waitForFunction for marks + network round-trip + evaluate). A
  // full measured loop of ~11 seed words plus DOM-scrape candidates can run 60-90s.
  // Default 30s is insufficient. revealMs sacred gate still enforced per-iteration
  // via expect().toBeLessThan(50) — this timeout is purely end-to-end budget, not
  // a latency relaxation.
  timeout: 180_000,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
