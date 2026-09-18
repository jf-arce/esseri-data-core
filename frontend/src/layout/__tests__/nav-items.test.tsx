import { describe, expect, it } from 'vitest'
import { NAV_GROUPS, filtrarNav, rutaInicioDe } from '@/layout/nav-items'
import type { Permiso } from '@/modules/auth/types'

function permiso(codigo: string): Permiso {
  return {
    id: codigo,
    codigo,
    modulo: codigo.split('.')[0],
    accion: codigo.split('.')[1],
    tipo_informacion: null,
  }
}

describe('filtrarNav', () => {
  it('sin rol activo ni permisos, no muestra nada', () => {
    const grupos = filtrarNav(NAV_GROUPS, null, [])

    expect(grupos).toEqual([])
  })

  it('un módulo sin su permiso desaparece, hijos incluidos', () => {
    // "Académico" (estructura curricular) pide el `.leer` para entrar — un permiso de otro
    // módulo (ej. Familias) no lo desbloquea, ni viceversa.
    const grupos = filtrarNav(NAV_GROUPS, 'secretaría', [permiso('academico.leer')])

    const labels = grupos.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).toContain('Académico')
    expect(labels).not.toContain('Familias y alumnos')
  })

  it('dirección ve "Académico" con solo `.leer` (mira la estructura, no la opera)', () => {
    // Antes esta sección pedía el `actualizar` de escritura para simplemente entrar: dirección
    // (que solo tiene `.leer`/`.exportar` por diseño, grupo-b.yaml) quedaba afuera aunque el
    // Panel de Dirección la linkeara. Ahora alcanza con `.leer`; los botones de crear/editar/
    // eliminar se ocultan aparte, dentro de la página (`estructura-academica-page.tsx`).
    const grupos = filtrarNav(NAV_GROUPS, 'direccion', [permiso('academico.leer')])

    const labels = grupos.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).toContain('Académico')
  })

  it('no muestra Justificaciones solo con el permiso de lectura académica', () => {
    const grupos = filtrarNav(NAV_GROUPS, 'direccion', [permiso('academico.leer')])

    const academico = grupos.flatMap((g) => g.items).find((i) => i.label === 'Académico')
    const hijos = academico?.children?.map((h) => h.label) ?? []
    expect(hijos).not.toContain('Justificaciones')
  })

  it('muestra Justificaciones con el permiso institucional específico', () => {
    const grupos = filtrarNav(NAV_GROUPS, 'direccion', [
      permiso('academico.leer'),
      permiso('academico.actualizar:justificaciones'),
    ])

    const academico = grupos.flatMap((g) => g.items).find((i) => i.label === 'Académico')
    const hijos = academico?.children?.map((h) => h.label) ?? []
    expect(hijos).toContain('Justificaciones')
    expect(hijos).not.toContain('Justificaciones de asistencia')
  })

  it('"Tomar asistencia" (anidado en Académico) pide el permiso tipado de asistencia, no la estructura', () => {
    // Anidado bajo "Académico" (§ nota de filtrado en nav-items.ts): el padre necesita su
    // propio `academico.leer` para que sus hijos se evalúen — un docente real siempre lo
    // tiene (ver seed), así que en la práctica esto nunca se oculta para él.
    const grupos = filtrarNav(NAV_GROUPS, 'docente', [
      permiso('academico.leer'),
      permiso('academico.actualizar:asistencia'),
    ])

    const academico = grupos.flatMap((g) => g.items).find((i) => i.label === 'Académico')
    const hijos = academico?.children?.map((h) => h.label) ?? []
    expect(hijos).toContain('Tomar asistencia')
    expect(hijos).toContain('Asignaciones docentes')
    expect(hijos).not.toContain('Justificaciones')
  })

  it('"Tomar asistencia" desaparece sin su permiso tipado, aunque el padre sea visible', () => {
    const grupos = filtrarNav(NAV_GROUPS, 'docente', [permiso('academico.leer')])

    const academico = grupos.flatMap((g) => g.items).find((i) => i.label === 'Académico')
    const hijos = academico?.children?.map((h) => h.label) ?? []
    expect(hijos).not.toContain('Tomar asistencia')
  })

  it('un ítem con roles (los paneles) exige también el rol activo, no solo el permiso', () => {
    const grupos = filtrarNav(NAV_GROUPS, 'docente', [permiso('panel_administrativo.leer')])

    const labels = grupos.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).not.toContain('Panel de Dirección')
    expect(labels).not.toContain('Panel Administrativo')
  })

  it('dirección con panel_administrativo.leer ve el Panel de Dirección, no el Administrativo', () => {
    const grupos = filtrarNav(NAV_GROUPS, 'direccion', [permiso('panel_administrativo.leer')])

    const labels = grupos.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).toContain('Panel de Dirección')
    expect(labels).not.toContain('Panel Administrativo')
  })

  it('administrador del sistema (grupo-b.yaml: "= todo") ve los dos paneles', () => {
    const grupos = filtrarNav(NAV_GROUPS, 'administrador_del_sistema', [
      permiso('panel_administrativo.leer'),
    ])

    const labels = grupos.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).toContain('Panel de Dirección')
    expect(labels).toContain('Panel Administrativo')
  })

  it('un padre sin hijos visibles ni landing propia desaparece entero', () => {
    // "Proveedores y compras" no tiene `permiso` propio ni `href`: sin el permiso de sus
    // hijos, no debería quedar un ítem fantasma con `children: []`.
    const grupos = filtrarNav(NAV_GROUPS, 'direccion', [permiso('academico.leer')])

    const labels = grupos.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).not.toContain('Proveedores y compras')
  })
})

describe('rutaInicioDe', () => {
  it('dirección va a /panel', () => {
    expect(rutaInicioDe('direccion', [permiso('panel_administrativo.leer')])).toBe('/panel')
  })

  it('la pantalla de inicio por default de administrador del sistema es /panel (aunque también puede entrar a /admin)', () => {
    expect(rutaInicioDe('administrador_del_sistema', [permiso('panel_administrativo.leer')])).toBe(
      '/panel',
    )
  })

  it('administración va a /admin', () => {
    expect(rutaInicioDe('administracion', [permiso('panel_administrativo.leer')])).toBe('/admin')
  })

  it('un rol de consola sin panel entra por el primer módulo al que tiene acceso', () => {
    expect(rutaInicioDe('secretaría', [permiso('familias_alumnos.leer')])).toBe('/familias-alumnos')
  })

  it('un rol de consola sin ningún acceso devuelve null (pantalla "sin acceso")', () => {
    expect(rutaInicioDe('secretaría', [])).toBeNull()
  })

  it('docente (Portal) siempre cae en /docente: todavía no tiene pantallas propias', () => {
    // El Portal lo construye otro integrante del equipo — por ahora es una página en blanco,
    // así que no hay ítems que buscar: cualquier permiso del rol activo da lo mismo.
    expect(rutaInicioDe('docente', [permiso('academico.actualizar:asistencia')])).toBe('/docente')
    expect(rutaInicioDe('docente', [])).toBe('/docente')
  })

  it('familia (Portal, sin pantallas propias todavía) siempre cae en /familia', () => {
    expect(rutaInicioDe('familia', [])).toBe('/familia')
  })

  it('sin rol activo, un panel (con `roles`) no cuenta pero un módulo por permiso sí', () => {
    // En la práctica `RolActivoRoute` nunca deja llegar acá con `rolActivo: null` — este caso
    // cubre el comportamiento de la función pura: `roles` en un ítem exige rol activo, un
    // `permiso` solo exige el código.
    expect(rutaInicioDe(null, [permiso('panel_administrativo.leer')])).toBeNull()
    expect(rutaInicioDe(null, [permiso('academico.leer')])).toBe('/academico')
  })
})
