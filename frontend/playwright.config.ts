import { defineConfig, devices } from '@playwright/test'

// RNF-02 (#224): las pantallas principales en los motores de Chrome/Edge, Firefox y Safari, en
// escritorio y en móvil. Edge usa el mismo motor que Chrome (Chromium) y Safari se prueba con
// WebKit, el motor que Playwright trae para eso.
//
// `E2E_BASE_URL` apunta a un entorno ya levantado (por ejemplo el stack de Docker con el seed de
// demo). Sin ella, Playwright levanta `npm run dev` en 5173 y hace falta un backend corriendo.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const SESION = 'e2e/.auth/demo.json'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    ...[
      { name: 'chromium', use: devices['Desktop Chrome'] },
      { name: 'firefox', use: devices['Desktop Firefox'] },
      { name: 'webkit', use: devices['Desktop Safari'] },
      { name: 'mobile-chrome', use: devices['Pixel 7'] },
      { name: 'mobile-safari', use: devices['iPhone 14'] },
    ].map(({ name, use }) => ({
      name,
      use: { ...use, storageState: SESION },
      dependencies: ['setup'],
    })),
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: baseURL, reuseExistingServer: true },
})
