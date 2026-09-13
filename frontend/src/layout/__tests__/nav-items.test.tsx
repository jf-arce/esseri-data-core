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
    // "Académico" (estructura curricular) pide el `actualizar` sin tipo, no `.leer` — así un
    // docente (que solo tiene el `actualizar` tipado de asistencia) no lo ve.
    const grupos = filtrarNav(NAV_GROUPS, 'secretaría', [permiso('academico.actualizar')])

    const labels = grupos.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).toContain('Académico')
    expect(labels).not.toContain('Familias y alumnos')
  })

  it('"Tomar asistencia" pide el permiso tipado de asistencia, no la estructura', () => {
    const grupos = filtrarNav(NAV_GROUPS, 'docente', [permiso('academico.actualizar:asistencia')])

    const labels = grupos.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).toContain('Tomar asistencia')
    expect(labels).not.toContain('Académico')
  })

  it('un ítem con roles (los paneles) exige también el rol activo, no solo el permiso', () => {
    const grupos = filtrarNav(NAV_GROUPS, 'docente', [permiso('panel_administrativo.leer')])

    const labels = grupos.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).not.toContain('Panel de Dirección')
    expect(labels).not.toContain('Panel Administrativo')
  })

  it('dirección con panel_administrativo.leer ve el Panel de Dirección, no el Administrativo', () => {
    const grupos = filtrarNav(NAV_GROUPS, 'dirección', [permiso('panel_administrativo.leer')])

    const labels = grupos.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).toContain('Panel de Dirección')
    expect(labels).not.toContain('Panel Administrativo')
  })

  it('administrador del sistema (grupo-b.yaml: "= todo") ve los dos paneles', () => {
    const grupos = filtrarNav(NAV_GROUPS, 'administrador del sistema', [
      permiso('panel_administrativo.leer'),
    ])

    const labels = grupos.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).toContain('Panel de Dirección')
    expect(labels).toContain('Panel Administrativo')
  })

  it('un padre sin hijos visibles ni landing propia desaparece entero', () => {
    // "Proveedores y compras" no tiene `permiso` propio ni `href`: sin el permiso de sus
    // hijos, no debería quedar un ítem fantasma con `children: []`.
    const grupos = filtrarNav(NAV_GROUPS, 'dirección', [permiso('academico.leer')])

    const labels = grupos.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).not.toContain('Proveedores y compras')
  })
})

describe('rutaInicioDe', () => {
  it('dirección va a /panel', () => {
    expect(rutaInicioDe('dirección', [permiso('panel_administrativo.leer')])).toBe('/panel')
  })

  it('la pantalla de inicio por default de administrador del sistema es /panel (aunque también puede entrar a /admin)', () => {
    expect(rutaInicioDe('administrador del sistema', [permiso('panel_administrativo.leer')])).toBe(
      '/panel',
    )
  })

  it('administración va a /admin', () => {
    expect(rutaInicioDe('administración', [permiso('panel_administrativo.leer')])).toBe('/admin')
  })

  it('un rol sin panel entra por el primer módulo al que tiene acceso', () => {
    // Docente real: solo el permiso tipado de asistencia, nunca el `actualizar` de estructura
    // (ver nav-items.test.tsx > filtrarNav) — su único módulo visible es "Tomar asistencia".
    expect(rutaInicioDe('docente', [permiso('academico.actualizar:asistencia')])).toBe(
      '/academico/asistencia',
    )
  })

  it('un rol sin ningún acceso devuelve null (pantalla "sin acceso")', () => {
    expect(rutaInicioDe('docente', [])).toBeNull()
  })

  it('sin rol activo, un panel (con `roles`) no cuenta pero un módulo por permiso sí', () => {
    // En la práctica `RolActivoRoute` nunca deja llegar acá con `rolActivo: null` — este caso
    // cubre el comportamiento de la función pura: `roles` en un ítem exige rol activo, un
    // `permiso` solo exige el código.
    expect(rutaInicioDe(null, [permiso('panel_administrativo.leer')])).toBeNull()
    expect(rutaInicioDe(null, [permiso('academico.actualizar')])).toBe('/academico')
  })
})
