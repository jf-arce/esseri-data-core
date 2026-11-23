import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
      passWithNoTests: true,
      // Los tests de páginas completas (userEvent + muchas queries) pasan de 5 s en runners de CI
      // con poca CPU; el default de Vitest los cortaba por timeout aunque no hubiera fallas reales.
      testTimeout: 15000,
      // `e2e/` son specs de Playwright: corren con `npm run test:e2e`, no con Vitest.
      exclude: [...configDefaults.exclude, 'e2e/**'],
    },
  }),
)
