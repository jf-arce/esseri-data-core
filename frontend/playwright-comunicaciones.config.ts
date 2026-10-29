import { defineConfig, devices } from '@playwright/test'

// Dedicated real-backend flow: no mocked responses or shared demo login setup.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'comunicaciones.spec.ts',
  fullyParallel: false,
  workers: 1,
  outputDir: process.env.E2E_OUTPUT_DIR ?? 'test-results',
  reporter: 'list',
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
})
