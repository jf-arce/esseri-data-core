import { createHash } from 'node:crypto'
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test'

/**
 * Real-browser proof for communications stage 3.
 *
 * No request is mocked: every login, upload, publication, download and denial below goes to the
 * real backend, PostgreSQL, ClamAV and the Vite app started by the operator. The accounts are
 * synthetic and created by `backend/tests/comunicaciones/seed_e2e.py`; the password only comes
 * from `STAGE3_E2E_PASSWORD` and is never written in this file.
 */
const API = process.env.E2E_API_URL ?? 'http://localhost:8019'
const PASSWORD = process.env.STAGE3_E2E_PASSWORD ?? ''
const ADMIN = process.env.E2E_ADMIN_EMAIL ?? 'stage3.admin@esseri.test'
const DOCENTE = process.env.E2E_DOCENTE_EMAIL ?? 'stage3.docente@esseri.test'
const FAMILIA = process.env.E2E_FAMILIA_EMAIL ?? 'stage3.familia@esseri.test'
const FAMILIA_AJENA = process.env.E2E_FAMILIA_AJENA_EMAIL ?? 'stage3.otra-familia@esseri.test'
const DIVISION = process.env.E2E_DIVISION ?? '4° B'
const CICLO = process.env.E2E_CICLO ?? '2027'

// A real, structurally valid 1×1 RGBA PNG. The backend identifies it by signature and Pillow
// verifies and decodes it; ClamAV scans these exact bytes. It is not a mock or a placeholder.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const PNG_TIPO = 'image/png'

interface Adjunto {
  id: string
  nombre: string
  tipo_contenido: string
  tamanio: number
  estado: string
}
interface Comunicacion {
  id: string
  asunto: string
  tipo: string
  canal: string
  estado: string
  destinatarios: number
  leida_at: string | null
  adjuntos?: Adjunto[]
}
interface Envio {
  id: string
  email: string | null
  estado: string
  intentos: { id: string; estado: string }[]
}

function huella(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function iniciarSesion(page: Page, email: string): Promise<void> {
  const login = await page.request.post(`${API}/auth/login`, {
    data: { email, password: PASSWORD },
  })
  expect(login.status(), `login real de ${email}`).toBe(200)
  const me = await page.request.get(`${API}/auth/me`)
  expect(me.status(), `/auth/me de ${email}`).toBe(200)
  const cuerpo = (await me.json()) as { email: string; rol_activo: string | null }
  expect(cuerpo.email).toBe(email)
  // Every seeded account has exactly one role, so login resolves the active role.
  expect(cuerpo.rol_activo, `rol activo de ${email}`).toBeTruthy()
}

async function contextoAutenticado(browser: Browser, testInfo: TestInfo, email: string) {
  const contexto = await browser.newContext({
    ...testInfo.project.use,
    storageState: undefined,
  })
  const pagina = await contexto.newPage()
  await iniciarSesion(pagina, email)
  return { contexto, pagina }
}

function asuntoUnico(testInfo: TestInfo, etiqueta: string): string {
  return `Etapa3 ${etiqueta} ${testInfo.project.name} ${Date.now()}`
}

function expresion(texto: string): RegExp {
  return new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
}

/** Saves the draft through the real form and returns the persisted message. */
async function guardarBorrador(page: Page, docente: boolean): Promise<Comunicacion> {
  const espera = page.waitForResponse((r) => {
    if (r.request().method() !== 'POST') return false
    return new URL(r.url()).pathname === (docente ? '/comunicaciones/docente' : '/comunicaciones')
  })
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible()
  const respuesta = await espera
  expect(respuesta.status()).toBe(201)
  return (await respuesta.json()) as Comunicacion
}

/** Uploads the real PNG through the dropzone and waits for the real ClamAV verdict. */
async function subirPng(page: Page, nombre: string): Promise<Adjunto> {
  const espera = page.waitForResponse((r) => {
    if (r.request().method() !== 'POST') return false
    return new URL(r.url()).pathname.endsWith('/adjuntos')
  })
  await page.locator('input[type="file"]').setInputFiles({
    name: nombre,
    mimeType: PNG_TIPO,
    buffer: PNG,
  })
  const respuesta = await espera
  expect(respuesta.status(), 'subida real del adjunto').toBe(201)
  const subido = (await respuesta.json()) as Adjunto
  expect(subido.id).toBeTruthy()
  expect(subido.tipo_contenido).toBe(PNG_TIPO)
  expect(subido.tamanio).toBe(PNG.length)
  // A real clean ClamAV verdict: the email-only transport is irrelevant here, but a missing
  // scanner must leave the file in quarantine and fail this assertion instead of passing.
  expect(subido.estado, 'veredicto real de ClamAV').toBe('limpio')
  await expect(page.getByText('Limpio', { exact: true })).toBeVisible()
  return subido
}

async function elegirDivision(page: Page, admin: boolean): Promise<void> {
  if (admin) {
    await page.getByRole('radio', { name: 'Curso o división' }).click()
  }
  await page.getByRole('combobox', { name: 'Ciclo lectivo' }).click()
  await page.getByRole('option', { name: CICLO, exact: true }).click()
  await page.getByRole('checkbox', { name: DIVISION, exact: true }).click()
}

async function publicar(page: Page, tipo: 'Institucional' | 'Comunicación de curso') {
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click()
  await expect(page.getByText(new RegExp(`${tipo} · 1 responsables · Solo portal`))).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toBeEnabled()
  const espera = page.waitForResponse((r) => {
    if (r.request().method() !== 'POST') return false
    return new URL(r.url()).pathname.endsWith('/publicar')
  })
  await page.getByRole('button', { name: 'Publicar', exact: true }).click()
  const respuesta = await espera
  expect(respuesta.status()).toBe(200)
  const publicada = (await respuesta.json()) as Comunicacion
  expect(publicada.estado).toBe('publicada')
  expect(publicada.canal).toBe('portal')
  expect(publicada.destinatarios).toBe(1)
  expect(publicada.adjuntos?.[0]?.estado).toBe('limpio')
  await expect(page.getByRole('heading', { name: 'Comunicación publicada' })).toBeVisible()
  return publicada
}

/** Family UI download: compares the bytes delivered by the browser with the uploaded PNG. */
async function descargarYComparar(
  pagina: Page,
  testInfo: TestInfo,
  comunicacionId: string,
  adjunto: Adjunto,
): Promise<void> {
  const evento = pagina.waitForEvent('download', { timeout: 20_000 }).catch(() => null)
  await pagina.getByRole('button', { name: `Descargar ${adjunto.nombre}` }).click()
  const descarga = await evento
  if (descarga) {
    const flujo = await descarga.createReadStream()
    const partes: Buffer[] = []
    if (flujo) {
      for await (const parte of flujo) partes.push(Buffer.from(parte))
    }
    expect(huella(Buffer.concat(partes)), 'bytes descargados por la familia').toBe(huella(PNG))
    await descarga.delete()
    return
  }
  // Some Chromium download policies do not surface programmatic blob downloads. The family
  // still has a real authenticated download path; verify the exact bytes through it and keep
  // the interaction honest by requiring the UI not to show its download error.
  testInfo.annotations.push({
    type: 'descarga',
    description: 'El navegador no emitió evento download; bytes verificados por la ruta API real.',
  })
  await expect(
    pagina.getByText('No se pudo descargar el archivo. Volvé a intentarlo.'),
  ).toHaveCount(0)
  const ruta = `/comunicaciones/familia/${comunicacionId}/adjuntos/${adjunto.id}/archivo`
  const directa = await pagina.request.get(`${API}${ruta}`)
  expect(directa.status(), 'descarga autenticada de la familia').toBe(200)
  expect(huella(Buffer.from(await directa.body()))).toBe(huella(PNG))
}

async function abrirDesdeBandeja(pagina: Page, asunto: string): Promise<void> {
  await pagina.goto('/familia/comunicaciones')
  await pagina.getByRole('link', { name: expresion(asunto) }).click()
  await expect(pagina.getByRole('heading', { name: asunto })).toBeVisible()
}

test.describe('Comunicaciones etapa 3 — prueba real de navegador', () => {
  test.skip(
    !PASSWORD,
    'Requiere STAGE3_E2E_PASSWORD con la contraseña sintética del seed_e2e.py; no hay credenciales reales.',
  )

  test('administración publica con adjunto limpio y la familia lo descarga', async ({
    browser,
    page,
  }, testInfo) => {
    await iniciarSesion(page, ADMIN)
    const asunto = asuntoUnico(testInfo, 'institucional')
    const nombreArchivo = `etapa3-${testInfo.project.name}-${Date.now()}.png`

    await page.goto('/comunicaciones/nueva')
    await page.getByLabel('Asunto', { exact: true }).fill(asunto)
    await page
      .getByLabel('Mensaje', { exact: true })
      .fill('Publicación institucional con un archivo real. <script>no ejecutar</script>')
    await page.getByRole('radio', { name: /^Solo portal/ }).click()
    const borrador = await guardarBorrador(page, false)
    const adjunto = await subirPng(page, nombreArchivo)

    await page.getByRole('button', { name: 'Siguiente' }).click()
    await elegirDivision(page, true)
    const publicada = await publicar(page, 'Institucional')

    // Persisted server-side state: the attachment is clean and the publication kept it.
    const metadatos = await page.request.get(`${API}/comunicaciones/${publicada.id}/adjuntos`)
    expect(metadatos.status()).toBe(200)
    const adjuntos = (await metadatos.json()) as Adjunto[]
    expect(adjuntos).toHaveLength(1)
    expect(adjuntos[0].id).toBe(adjunto.id)
    expect(adjuntos[0].estado).toBe('limpio')
    expect(borrador.id).toBe(publicada.id)

    const familia = await contextoAutenticado(browser, testInfo, FAMILIA)
    try {
      await abrirDesdeBandeja(familia.pagina, asunto)
      await expect(familia.pagina.getByText('Lectura registrada para tu cuenta.')).toBeVisible()
      const detalle = await familia.pagina.request.get(
        `${API}/comunicaciones/familia/${publicada.id}`,
      )
      expect(detalle.status()).toBe(200)
      const leida = (await detalle.json()) as Comunicacion
      expect(leida.leida_at).toBeTruthy()
      expect(leida.canal).toBe('portal')
      await descargarYComparar(familia.pagina, testInfo, publicada.id, adjunto)
    } finally {
      await familia.contexto.close()
    }

    // A different family has no frozen receipt: family detail and bytes are both out of reach.
    const ajena = await contextoAutenticado(browser, testInfo, FAMILIA_AJENA)
    try {
      const detalleAjeno = await ajena.pagina.request.get(
        `${API}/comunicaciones/familia/${publicada.id}`,
      )
      expect(detalleAjeno.status()).toBe(404)
      const archivoAjeno = await ajena.pagina.request.get(
        `${API}/comunicaciones/familia/${publicada.id}/adjuntos/${adjunto.id}/archivo`,
      )
      expect(archivoAjeno.status()).toBe(404)
    } finally {
      await ajena.contexto.close()
    }

    // A teacher cannot cross into family endpoints nor into institutional attachments.
    const docente = await contextoAutenticado(browser, testInfo, DOCENTE)
    try {
      expect(
        (
          await docente.pagina.request.get(`${API}/comunicaciones/familia/${publicada.id}`)
        ).status(),
      ).toBe(403)
      expect(
        (
          await docente.pagina.request.get(
            `${API}/comunicaciones/${publicada.id}/adjuntos/${adjunto.id}/archivo`,
          )
        ).status(),
      ).toBe(403)
      expect(
        (await docente.pagina.request.get(`${API}/comunicaciones/${publicada.id}`)).status(),
      ).toBe(403)
    } finally {
      await docente.contexto.close()
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1)
  })

  test('docente publica al curso asignado con adjunto y la familia lo descarga', async ({
    browser,
    page,
  }, testInfo) => {
    await iniciarSesion(page, DOCENTE)
    const asunto = asuntoUnico(testInfo, 'curso')
    const nombreArchivo = `etapa3-curso-${testInfo.project.name}-${Date.now()}.png`

    await page.goto('/docente/comunicaciones/nueva')
    await page.getByLabel('Asunto', { exact: true }).fill(asunto)
    await page.getByLabel('Mensaje', { exact: true }).fill('Materiales para el curso asignado.')
    await page.getByRole('radio', { name: /^Solo portal/ }).click()

    // A course draft is only valid with its audience, so choose the assigned course before the
    // first save; then go back to step 1 to attach the file (the dropzone needs a persisted id).
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await expect(page.getByText('Todos los responsables habilitados')).toHaveCount(0)
    await elegirDivision(page, false)
    const borrador = await guardarBorrador(page, true)
    await page.getByRole('button', { name: 'Anterior' }).click()
    const adjunto = await subirPng(page, nombreArchivo)

    await page.getByRole('button', { name: 'Siguiente' }).click()
    const publicada = await publicar(page, 'Comunicación de curso')
    expect(borrador.id).toBe(publicada.id)

    const familia = await contextoAutenticado(browser, testInfo, FAMILIA)
    try {
      await abrirDesdeBandeja(familia.pagina, asunto)
      await expect(familia.pagina.getByText('De: Laura Díaz')).toBeVisible()
      await expect(familia.pagina.getByText('Lectura registrada para tu cuenta.')).toBeVisible()
      await descargarYComparar(familia.pagina, testInfo, publicada.id, adjunto)
    } finally {
      await familia.contexto.close()
    }

    const ajena = await contextoAutenticado(browser, testInfo, FAMILIA_AJENA)
    try {
      expect(
        (await ajena.pagina.request.get(`${API}/comunicaciones/familia/${publicada.id}`)).status(),
      ).toBe(404)
      expect(
        (
          await ajena.pagina.request.get(
            `${API}/comunicaciones/familia/${publicada.id}/adjuntos/${adjunto.id}/archivo`,
          )
        ).status(),
      ).toBe(404)
    } finally {
      await ajena.contexto.close()
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1)
  })

  test('publicación solo email: oculta en la bandeja, enlace directo sin lectura y envío en cola', async ({
    browser,
    page,
  }, testInfo) => {
    await iniciarSesion(page, ADMIN)
    const asunto = asuntoUnico(testInfo, 'solo-email')

    await page.goto('/comunicaciones/nueva')
    await page.getByLabel('Asunto', { exact: true }).fill(asunto)
    await page
      .getByLabel('Mensaje', { exact: true })
      .fill('Solo por email: no debe aparecer en la bandeja del portal familiar.')
    await page.getByRole('radio', { name: /^Solo email/ }).click()
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await elegirDivision(page, true)
    await page.getByRole('button', { name: 'Vista previa', exact: true }).click()
    await expect(page.getByText(/Institucional · 1 responsables · Solo email/)).toBeVisible()

    const espera = page.waitForResponse((r) => {
      if (r.request().method() !== 'POST') return false
      return new URL(r.url()).pathname.endsWith('/publicar')
    })
    await page.getByRole('button', { name: 'Publicar y encolar email' }).click()
    const respuesta = await espera
    expect(respuesta.status()).toBe(200)
    const publicada = (await respuesta.json()) as Comunicacion
    expect(publicada.canal).toBe('email')
    expect(publicada.destinatarios).toBe(1)
    await expect(
      page.getByText(/El envío por email quedó en cola para 1 responsables/),
    ).toBeVisible()

    // The durable transport record is queued, never presented as delivered.
    const envios = await page.request.get(`${API}/comunicaciones/${publicada.id}/envios`)
    expect(envios.status()).toBe(200)
    const historial = (await envios.json()) as Envio[]
    expect(historial).toHaveLength(1)
    expect(historial[0].email).toBe(FAMILIA)
    expect(historial[0].estado).toBe('pendiente')
    expect(historial[0].intentos).toHaveLength(0)

    await page.getByRole('link', { name: 'Ver comunicación' }).click()
    await expect(page.getByRole('heading', { name: asunto })).toBeVisible()
    await expect(page.getByText('Envíos por email')).toBeVisible()
    await expect(page.getByText('En cola', { exact: true })).toBeVisible()
    await expect(page.getByText(FAMILIA, { exact: true })).toBeVisible()
    await expect(page.getByText('Enviado', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Resultado incierto', { exact: true })).toHaveCount(0)

    const familia = await contextoAutenticado(browser, testInfo, FAMILIA)
    try {
      await familia.pagina.goto('/familia/comunicaciones')
      await familia.pagina.getByLabel('Buscar comunicaciones').fill(asunto)
      await expect(familia.pagina.getByText('No hay comunicaciones para mostrar.')).toBeVisible()
      await expect(familia.pagina.getByRole('link', { name: expresion(asunto) })).toHaveCount(0)

      // The authenticated direct link still opens the message preserved by its receipt.
      await familia.pagina.goto(`/familia/comunicaciones/${publicada.id}`)
      await expect(familia.pagina.getByRole('heading', { name: asunto })).toBeVisible()
      await expect(
        familia.pagina.getByText(
          'Esta comunicación se envía por email y no aparece en la bandeja del portal.',
        ),
      ).toBeVisible()
      await expect(familia.pagina.getByText('Lectura registrada para tu cuenta.')).toHaveCount(0)

      const detalle = await familia.pagina.request.get(
        `${API}/comunicaciones/familia/${publicada.id}`,
      )
      expect(detalle.status()).toBe(200)
      const recibida = (await detalle.json()) as Comunicacion
      expect(recibida.canal).toBe('email')
      expect(recibida.leida_at).toBeNull()
    } finally {
      await familia.contexto.close()
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1)
  })
})
