import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:5187'

// These browser tests intercept the API and do not need a seeded backend or stored login.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'autosave-comunicaciones.spec.ts',
  outputDir: process.env.E2E_OUTPUT_DIR ?? 'test-results/comunicaciones-autosave',
  use: { baseURL },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5187 --strictPort',
    url: baseURL,
    env: { VITE_API_URL: 'http://127.0.0.1:8187' },
  },
  projects: [
    { name: 'desktop-chromium', use: devices['Desktop Chrome'] },
    { name: 'mobile-chrome', use: devices['Pixel 7'] },
  ],
})
