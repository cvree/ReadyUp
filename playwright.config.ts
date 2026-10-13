import { defineConfig } from '@playwright/test'

// End-to-end tests drive the built Electron app (npm run build first).
// On Linux without a display, run under xvfb-run (see npm run test:e2e).
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results'
})
