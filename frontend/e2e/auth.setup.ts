import { expect, test as setup } from '@playwright/test'

// Inicia sesión una sola vez con la cuenta del seed de demo y guarda la sesión para que los specs
// arranquen ya logueados. La cookie de sesión es la misma en todos los navegadores.
setup('iniciar sesión con la cuenta de demo', async ({ page }) => {
  await page.goto('/login')
  await page
    .getByLabel('Correo institucional')
    .fill(process.env.E2E_EMAIL ?? 'demo.admin@esseri.local')
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill(process.env.E2E_PASSWORD ?? 'EsseriDemo2026!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  await expect(page).not.toHaveURL(/\/login/)
  await page.context().storageState({ path: 'e2e/.auth/demo.json' })
})
