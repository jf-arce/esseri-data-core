import { expect, test } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('family and Administration discuss a period request without changing the request', async ({
  browser,
  baseURL,
}) => {
  test.skip(
    process.env.E2E_CONVERSACIONES_REAL !== 'true',
    'Requires a dedicated seeded ESSERI instance; this test creates a period request.',
  )
  const api = process.env.E2E_API_URL
  const password = process.env.E2E_PASSWORD ?? 'EsseriDemo2026!'
  if (!api || !baseURL) throw new Error('An isolated frontend and backend URL are required.')

  const familia = await browser.newContext({ baseURL })
  const administracion = await browser.newContext({ baseURL })
  try {
    await expect(
      await familia.request.post(`${api}/auth/login`, {
        data: {
          email: process.env.E2E_CONVERSACIONES_FAMILIA ?? 'familia-39101010@esseri.local',
          password,
        },
      }),
    ).toBeOK()
    await expect(
      await administracion.request.post(`${api}/auth/login`, {
        data: {
          email: process.env.E2E_CONVERSACIONES_ADMIN ?? 'administracion@esseri.local',
          password,
        },
      }),
    ).toBeOK()

    const alumnos = await familia.request.get(`${api}/familias-alumnos/familias/me/alumnos`)
    await expect(alumnos).toBeOK()
    const [alumno] = (await alumnos.json()) as { alumno_id: string }[]
    expect(alumno?.alumno_id).toBeTruthy()
    const solicitudesURL = `${api}/academico/familia/alumnos/${alumno.alumno_id}/solicitudes-ausencia`
    const solicitudes = await familia.request.get(solicitudesURL)
    await expect(solicitudes).toBeOK()
    const existentes = (await solicitudes.json()) as {
      id: string
      fecha_inicio: string
      fecha_fin: string
    }[]
    // Reutiliza el trámite ya creado por una corrida anterior; si no hay, crea uno dentro de la
    // ventana que el backend acepta (últimos días justificables, nunca un ciclo futuro).
    let solicitud: { id: string; estado?: string } = existentes.at(-1) ?? { id: '' }
    if (!solicitud.id) {
      const fecha = new Date()
      fecha.setUTCDate(fecha.getUTCDate() - 1)
      const fecha_inicio = fecha.toISOString().slice(0, 10)
      fecha.setUTCDate(fecha.getUTCDate() + 1)
      const fecha_fin = fecha.toISOString().slice(0, 10)
      const alta = await familia.request.post(`${api}/academico/familia/solicitudes-ausencia`, {
        multipart: { alumno_id: alumno.alumno_id, fecha_inicio, fecha_fin, motivo: 'enfermedad' },
      })
      await expect(alta).toBeOK()
      solicitud = await alta.json()
    }
    const inicio = `alumno=${alumno.alumno_id}&seccion=justificaciones&recurso=solicitud_ausencia_periodo&recurso_id=${solicitud.id}`
    const portal = await familia.newPage()
    await portal.goto(`/familia/asistencias?${inicio}`)
    await portal.getByRole('link', { name: 'Conversación sobre esta justificación' }).click()
    const sello = Date.now()
    const consulta = `Consulta sobre la ausencia ${solicitud.id} (${sello})`
    const respuesta = `Gracias. Por favor, confirmá la documentación (${sello}).`
    await portal.getByRole('textbox', { name: 'Mensaje' }).fill(consulta)
    await portal.getByRole('button', { name: 'Enviar mensaje' }).click()
    await expect(portal).toHaveURL(/\/familia\/conversaciones\/[a-f\d-]+$/)
    await expect(portal.getByText(consulta)).toBeVisible()
    const rutaHilo = new URL(portal.url()).pathname

    const backoffice = await administracion.newPage()
    await backoffice.goto('/comunicaciones/conversaciones')
    const hiloId = rutaHilo.split('/').at(-1)
    const enlace = backoffice
      .getByRole('link', { name: /Justificación por período/ })
      .and(backoffice.locator(`a[href="/comunicaciones/conversaciones/${hiloId}"]`))
    await expect(enlace).toBeVisible()
    await enlace.click()
    await expect(backoffice.getByText(consulta)).toBeVisible()
    await backoffice.getByRole('textbox', { name: 'Mensaje' }).fill(respuesta)
    await backoffice.getByRole('button', { name: 'Enviar mensaje' }).click()
    await expect(backoffice.getByText(respuesta)).toBeVisible()

    await portal.reload()
    await portal.getByRole('button', { name: /^Notificaciones\./ }).click()
    await portal
      .getByRole('link', { name: /Nuevo mensaje de Administración/ })
      .and(portal.locator(`a[href="${rutaHilo}"]`))
      .first()
      .click()
    await expect(portal).toHaveURL(new RegExp(`${rutaHilo}$`))
    await expect(portal.getByText(respuesta)).toBeVisible()

    await backoffice.getByRole('button', { name: 'Resolver conversación' }).click()
    await expect(backoffice.getByText('Resuelta', { exact: true })).toBeVisible()
    await backoffice.getByRole('button', { name: 'Reabrir conversación' }).click()
    await expect(backoffice.getByText('Pendiente de la familia', { exact: true })).toBeVisible()
    const vigentes = await familia.request.get(solicitudesURL)
    await expect(vigentes).toBeOK()
    const actual = (await vigentes.json()).find(({ id }: { id: string }) => id === solicitud.id)
    expect(actual.estado).toBe(solicitud.estado)
  } finally {
    await administracion.close()
    await familia.close()
  }
})
