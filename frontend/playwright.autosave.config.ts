import { defineConfig, devices } from '@playwright/test'

// Configuración aislada para la recuperación de borradores: no depende del stack Docker ni
// del seed de demo, porque intercepta la API desde el navegador real.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5199'

export default defineConfig({
  testDir: './e2e',
  testMatch: /autosave-comunicaciones\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL, trace: 'off' },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'VITE_API_URL=http://localhost:5199 npm run dev -- --port 5199 --strictPort',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
})
