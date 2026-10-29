import { expect, test } from '@playwright/test'

test('administration publishes and family reads persisted communication', async ({
  browser,
  page,
}, testInfo) => {
  test.skip(
    process.env.E2E_COMUNICACIONES_REAL !== 'true',
    'Requires an explicitly selected isolated real backend and test accounts.',
  )
  const api = process.env.E2E_API_URL!
  const password = process.env.E2E_COMUNICACIONES_PASSWORD!
  expect(api).toBeTruthy()
  expect(password).toBeTruthy()
  const login = await page.request.post(`${api}/auth/login`, {
    data: {
      email: process.env.E2E_COMUNICACIONES_ADMIN,
      password,
    },
  })
  expect(login.status()).toBe(200)
  const asunto = `Comunicación E2E ${testInfo.project.name} ${Date.now()}`
  await page.goto('/comunicaciones/nueva')
  await page.getByLabel('Asunto', { exact: true }).fill(asunto)
  await page
    .getByLabel('Mensaje', { exact: true })
    .fill('Información institucional persistida. <script>no ejecutar</script>')
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(page.getByRole('status')).toHaveText('Borrador guardado')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click()
  await expect(page.getByText(/Institucional · \d+ responsables/)).toBeVisible()
  const publicacion = page.waitForResponse(
    (r) => r.url().endsWith('/publicar') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Publicar', exact: true }).click()
  const publicada = await publicacion
  expect(publicada.status()).toBe(200)
  const { id } = (await publicada.json()) as { id: string }
  await expect(page.getByRole('heading', { name: 'Comunicación publicada' })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1)

  const familia = await browser.newContext({ ...testInfo.project.use, storageState: undefined })
  try {
    const familiar = await familia.newPage()
    const sesion = await familia.request.post(`${api}/auth/login`, {
      data: {
        email: process.env.E2E_COMUNICACIONES_FAMILIA,
        password,
      },
    })
    expect(sesion.status()).toBe(200)
    await familiar.goto(`${testInfo.project.use.baseURL}/familia/comunicaciones`)
    await familiar.getByRole('link', { name: new RegExp(asunto) }).click()
    await expect(familiar.getByRole('heading', { name: asunto })).toBeVisible()
    await expect(familiar.getByText('Lectura registrada para tu cuenta.')).toBeVisible()
    expect(
      await familiar.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1)
    await familiar.reload()
    await expect(familiar.getByText('Lectura registrada para tu cuenta.')).toBeVisible()
    const comprobacion = await familia.request.get(`${api}/comunicaciones/familia/${id}`)
    expect(comprobacion.status()).toBe(200)
    expect((await comprobacion.json()).leida_at).toBeTruthy()
  } finally {
    await familia.close()
  }
})
