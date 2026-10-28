import { expect, test } from '@playwright/test'

// RNF-02 (#224): cada pantalla del menú que se muestra en la demo carga, muestra su título y no
// tira errores de JavaScript ni se sale del ancho de la pantalla, en cada navegador del config.
const PANTALLAS: [ruta: string, titulo: RegExp][] = [
  ['/panel', /panel/i],
  ['/familias-alumnos', /familias/i],
  ['/familias-alumnos/alumnos', /alumnos/i],
  ['/academico', /académic|estructura/i],
  ['/academico/asistencia', /asistencia/i],
  ['/academico/justificaciones', /justificaci/i],
  ['/inscripciones', /inscripci/i],
  ['/inscripciones/admisiones', /admisi/i],
  ['/facturacion', /factura/i],
  ['/facturacion/deudas/familias', /deuda/i],
  ['/facturacion/reglas', /reglas de facturación/i],
  ['/facturacion/penalidades', /penalidades/i],
  ['/proveedores', /proveedores/i],
  ['/solicitudes-compra', /solicitudes/i],
  ['/ordenes-compra', /órdenes/i],
  ['/catalogo-compras', /catálogo/i],
  ['/workflows/reglas', /reglas/i],
  ['/workflows/ejecuciones', /ejecuciones/i],
  ['/workflows/notificaciones', /notificaciones/i],
  ['/workflows/tareas', /tareas/i],
  ['/sugerencias-ia', /sugerencias/i],
  ['/usuarios-roles/usuarios', /usuarios/i],
]

// Fallas conocidas: quedan registradas acá en vez de esconderse. Cuando se corrigen, Playwright
// avisa que el test "pasó cuando se esperaba que fallara" y hay que sacar la entrada.
const FALLAS_CONOCIDAS: { ruta: string; proyecto: RegExp; motivo: string }[] = [
  {
    ruta: '/facturacion',
    proyecto: /^mobile-/,
    motivo:
      'En celular la fila "Deudas por familia / Reglas / Nueva factura" no hace wrap y ensancha la página.',
  },
]

for (const [ruta, titulo] of PANTALLAS) {
  test(`${ruta} carga sin errores`, async ({ page }, testInfo) => {
    const conocida = FALLAS_CONOCIDAS.find(
      (falla) => falla.ruta === ruta && falla.proyecto.test(testInfo.project.name),
    )
    test.fail(conocida !== undefined, conocida?.motivo)
    const errores: string[] = []
    page.on('pageerror', (error) => errores.push(error.message))

    await page.goto(ruta)

    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(titulo)
    await expect(page.getByText('No encontramos esta página')).toHaveCount(0)
    // Las tablas anchas scrollean dentro de su contenedor: la página entera nunca.
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(desborde, 'la página se sale del ancho de la pantalla').toBeLessThanOrEqual(1)
    expect(errores, 'errores de JavaScript en la página').toEqual([])
  })
}
