import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Dedicated real-browser proof for communications stage 3. It deliberately has no auth.setup,
// no demo seed and no route mocking: every login and every API response comes from the real
// backend/PostgreSQL/ClamAV stack started by the operator on 5179/8019.
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const executablePath = existsSync(chrome) ? chrome : undefined

export default defineConfig({
  testDir: './e2e',
  testMatch: 'comunicaciones-etapa-3.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: process.env.E2E_OUTPUT_DIR ?? 'test-results/comunicaciones-etapa-3',
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5179',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
})
