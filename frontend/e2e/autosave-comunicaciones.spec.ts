import { expect, test, type Page } from '@playwright/test'

const crear = {
  id: 'permiso-crear',
  codigo: 'comunicaciones.crear',
  modulo: 'Comunicaciones',
  accion: 'crear',
  tipo_informacion: null,
}
const leer = { ...crear, id: 'permiso-leer', codigo: 'comunicaciones.leer', accion: 'leer' }

const usuario = {
  id: 'usuario-e2e',
  email: 'e2e@example.test',
  auth_provider: 'local',
  estado: 'activo',
  nombre_google: null,
  avatar_url: null,
  persona_nombre: 'E2E',
  persona_apellido: 'Prueba',
  roles: ['administracion'],
  permisos: [crear, leer],
  perfiles: [
    {
      id: 'rol-administracion',
      codigo: 'administracion',
      nombre: 'Administración',
      descripcion: null,
      permisos: [crear, leer],
    },
  ],
  rol_activo: 'administracion',
}

/** Fake API so the real app, real browser storage and real reloads can be exercised. */
async function prepararApi(
  page: Page,
  estado: { version: number; guardados: number; fallarRed?: boolean },
) {
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort()
    const esApi = /^\/(auth|comunicaciones|workflows)\b/.test(url.pathname)
    if (request.resourceType() === 'document' || !esApi) {
      return route.continue()
    }
    if (estado.fallarRed) {
      return route.abort('internetdisconnected')
    }
    if (url.pathname.startsWith('/auth/me')) {
      return route.fulfill({ json: usuario })
    }
    if (url.pathname.includes('/comunicaciones/opciones')) {
      return route.fulfill({
        json: { responsables: [], alumnos: [], niveles: [], divisiones: [], ciclos: ['2026'] },
      })
    }
    if (url.pathname.includes('/vista-previa')) return route.fulfill({ json: { destinatarios: 1 } })
    if (url.pathname.includes('/adjuntos')) return route.fulfill({ json: [] })
    if (url.pathname.includes('/entrega') || url.pathname.includes('/envios')) {
      return route.fulfill({ json: [] })
    }
    if (url.pathname.endsWith('/comunicaciones') || url.pathname.includes('/comunicaciones/')) {
      if (request.method() === 'POST' || request.method() === 'PUT') {
        estado.guardados += 1
        estado.version += 1
        const body = request.postDataJSON() as Record<string, unknown>
        return route.fulfill({
          status: request.method() === 'POST' ? 201 : 200,
          json: {
            id: 'borrador-e2e',
            clave: body.clave,
            asunto: body.asunto ?? '',
            cuerpo: body.cuerpo ?? '',
            cuerpo_rico: body.cuerpo_rico ?? null,
            tipo: body.tipo ?? 'institucional',
            estado: 'borrador',
            version: estado.version,
            autor_id: usuario.id,
            destinatarios: 0,
            audiencia: body.audiencia,
            created_at: '2026-11-05T00:00:00',
            publicada_at: null,
            leida_at: null,
            canal: body.canal ?? 'portal',
            adjuntos: [],
          },
        })
      }
      return route.fulfill({ json: { items: [], total: 0, pagina: 1, total_paginas: 0 } })
    }
    return route.fulfill({ json: {} })
  })
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test('recovers an unsaved subject after an immediate reload', async ({ page }) => {
  const estado = { version: 0, guardados: 0 }
  await prepararApi(page, estado)
  await page.goto('/comunicaciones/nueva')
  await page.getByLabel('Asunto').fill('Redacción interrumpida')
  await page.reload()
  await page.getByRole('button', { name: 'Recuperar borrador: Redacción interrumpida' }).click()
  await expect(page.getByLabel('Asunto')).toHaveValue('Redacción interrumpida')
})

test('recovers half-written text after closing and reopening the tab', async ({
  page,
  context,
}) => {
  const estado = { version: 0, guardados: 0 }
  await prepararApi(page, estado)
  await page.goto('/comunicaciones/nueva')
  await page.getByRole('textbox', { name: 'Mensaje' }).fill('Mensaje a medio escribir')
  await page.close()

  const nueva = await context.newPage()
  await prepararApi(nueva, estado)
  await nueva.goto('/comunicaciones/nueva')
  await nueva.getByRole('button', { name: 'Recuperar borrador: Sin asunto' }).click()
  await expect(nueva.getByRole('textbox', { name: 'Mensaje' })).toHaveText(
    'Mensaje a medio escribir',
  )
})

test('autosaves to the server after the debounce without pressing Guardar', async ({ page }) => {
  const estado = { version: 0, guardados: 0 }
  await prepararApi(page, estado)
  await page.goto('/comunicaciones/nueva')
  await page.getByLabel('Asunto').fill('Guardado automático')
  await expect.poll(() => estado.guardados, { timeout: 10_000 }).toBe(1)
  await expect(page.getByText('Borrador guardado en el servidor.')).toHaveCount(0)
})

test('keeps formatting when pasting and recovering a rich draft', async ({ page }) => {
  await prepararApi(page, { version: 0, guardados: 0 })
  await page.goto('/comunicaciones/nueva')
  const mensaje = page.getByRole('textbox', { name: 'Mensaje' })
  await mensaje.evaluate((editor) => {
    editor.focus()
    const datos = new DataTransfer()
    datos.setData('text/html', '<p><strong>Texto formateado</strong></p>')
    datos.setData('text/plain', 'Texto formateado')
    editor.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: datos, bubbles: true, cancelable: true }),
    )
  })
  await expect(mensaje.locator('strong')).toHaveText('Texto formateado')

  await page.reload()
  await page.getByRole('button', { name: 'Recuperar borrador: Sin asunto' }).click()
  await expect(mensaje.locator('strong')).toHaveText('Texto formateado')

  const tipo = await page.getByRole('combobox', { name: 'Tipo de comunicación' }).boundingBox()
  const canal = await page.getByRole('combobox', { name: 'Canal de envío' }).boundingBox()
  expect(tipo).not.toBeNull()
  expect(canal).not.toBeNull()
  if (page.viewportSize()!.width < 640) {
    expect(canal!.y).toBeGreaterThan(tipo!.y + tipo!.height)
  } else {
    expect(canal!.y).toBe(tipo!.y)
    expect(canal!.x).toBeGreaterThan(tipo!.x)
  }
  await page
    .getByRole('checkbox', { name: 'Agregar evento al calendario del Portal Familia' })
    .check()
  await expect(page.getByLabel('Título del evento')).toBeVisible()
})

test('keeps offline edits and syncs when the connection returns', async ({ page }) => {
  const estado = { version: 0, guardados: 0, fallarRed: false }
  await prepararApi(page, estado)
  await page.goto('/comunicaciones/nueva')
  await expect(page.getByLabel('Asunto')).toBeVisible()
  estado.fallarRed = true
  await page.getByLabel('Asunto').fill('Escrito sin conexión')
  await expect(page.getByText(/Sin conexión/)).toBeVisible({ timeout: 15_000 })
  estado.fallarRed = false
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => estado.guardados, { timeout: 20_000 }).toBe(1)
  await expect(page.getByText('Borrador guardado en el servidor.')).toHaveCount(0)
})
