import { expect, test } from '@playwright/test'

// Flujo completo de ausencias por período contra un backend aislado ya levantado:
// la familia informa un período, administración lo aprueba y lo revoca con aviso.
// Se salta salvo que el entorno se seleccione explícitamente, igual que el resto de los E2E.
test('familia informa, administración aprueba y revoca con aviso', async ({
  browser,
  page,
}, testInfo) => {
  test.skip(
    process.env.E2E_AUSENCIAS_REAL !== 'true',
    'Requires an explicitly selected isolated real backend and demo accounts.',
  )
  const api = process.env.E2E_API_URL!
  const password = process.env.E2E_PASSWORD ?? 'EsseriDemo2026!'
  const familiaEmail = process.env.E2E_AUSENCIAS_FAMILIA ?? 'familia-39101010@esseri.local'
  expect(api).toBeTruthy()

  const hoy = new Date()
  const desde = new Date(hoy)
  desde.setDate(desde.getDate() + 30)
  const hasta = new Date(desde)
  hasta.setDate(hasta.getDate() + 1)
  const iso = (fecha: Date) =>
    `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
      fecha.getDate(),
    ).padStart(2, '0')}`
  const observacion = `E2E ausencias ${testInfo.project.name} ${Date.now()}`
  const motivoRevocacion = `E2E revocación ${Date.now()}`

  const contextoFamilia = await browser.newContext({
    ...testInfo.project.use,
    storageState: undefined,
  })
  try {
    const familiar = await contextoFamilia.newPage()
    const sesion = await contextoFamilia.request.post(`${api}/auth/login`, {
      data: { email: familiaEmail, password },
    })
    expect(sesion.status()).toBe(200)

    await familiar.goto(`${testInfo.project.use.baseURL}/familia/asistencias`)
    const selectorAlumno = familiar.getByRole('combobox', { name: 'Alumno' })
    await expect(selectorAlumno).toBeVisible()
    const alumno = (await selectorAlumno.textContent())?.trim() ?? ''
    expect(alumno).not.toBe('')

    await familiar.getByRole('button', { name: 'Informar ausencia' }).first().click()
    const formulario = familiar.getByRole('dialog')
    await formulario.getByLabel('Desde').fill(iso(desde))
    await formulario.getByLabel(/Hasta/).fill(iso(hasta))
    await formulario.getByRole('combobox', { name: 'Motivo' }).click()
    await familiar.getByRole('option', { name: 'Enfermedad', exact: true }).click()
    await formulario.getByLabel(/Observación/).fill(observacion)
    await formulario.getByRole('button', { name: 'Informar ausencia' }).click()

    await expect(familiar.getByText('Solicitud enviada. Quedará en revisión.')).toBeVisible()
    await familiar.getByRole('tab', { name: 'Solicitudes' }).click()
    await expect(familiar.getByText(`Observación: ${observacion}`)).toBeVisible()
    await expect(familiar.getByText('Pendiente').first()).toBeVisible()

    await page.goto('/academico/solicitudes-ausencia')
    const filaPendiente = page
      .getByRole('row')
      .filter({ hasText: alumno })
      .filter({ hasText: observacion })
    await expect(filaPendiente).toBeVisible()
    await filaPendiente.getByRole('button', { name: 'Aprobar' }).click()
    await expect(page.getByText('Solicitud aprobada.')).toBeVisible()

    await page.getByRole('tab', { name: /^Aprobadas/ }).click()
    const filaAprobada = page
      .getByRole('row')
      .filter({ hasText: alumno })
      .filter({ hasText: observacion })
    await expect(filaAprobada).toBeVisible()
    await filaAprobada.getByRole('button', { name: 'Revocar' }).click()

    const revocacion = page.getByRole('dialog')
    await revocacion.getByLabel('Motivo de la revocación (obligatorio)').fill(motivoRevocacion)
    await revocacion.getByLabel('Notificar a la familia con este motivo').click()
    await revocacion.getByRole('button', { name: 'Confirmar revocación' }).click()
    await expect(
      page.getByText('Solicitud revocada. Se enviará el aviso a la familia.'),
    ).toBeVisible()

    await familiar.reload()
    await familiar.getByRole('tab', { name: 'Solicitudes' }).click()
    await expect(familiar.getByText(`Observación: ${observacion}`)).toBeVisible()
    await expect(familiar.getByText(`Resolución: ${motivoRevocacion}`)).toBeVisible()
    await expect(familiar.getByText('Revocada').first()).toBeVisible()
  } finally {
    await contextoFamilia.close()
  }
})
