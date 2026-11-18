import { describe, expect, it } from 'vitest'
import {
  etiquetaDeDestino,
  etiquetaDePantalla,
  RUTAS_DE_DESTINO,
  rutaDeDestino,
  rutaDeEntidad,
} from '../destinos'
import { permiso } from './auxiliares'

describe('rutaDeDestino', () => {
  const direccion = [
    permiso('panel_administrativo.leer'),
    permiso('facturacion.leer'),
    permiso('familias_alumnos.leer'),
  ]

  it('devuelve la ruta si el menú del rol la muestra', () => {
    expect(rutaDeDestino('deuda_por_familia', 'direccion', direccion)).toBe(
      '/facturacion/deudas/familias',
    )
  })

  it('rechaza un destino que el rol no ve en su menú', () => {
    expect(rutaDeDestino('usuarios', 'direccion', direccion)).toBeNull()
    expect(rutaDeDestino('deuda_por_familia', 'direccion', [])).toBeNull()
  })

  it('abre Académico filtrado por nivel, año y división', () => {
    const ids = {
      nivel: '11111111-1111-4111-8111-111111111111',
      anio: '22222222-2222-4222-8222-222222222222',
      division: '33333333-3333-4333-8333-333333333333',
    }
    const permisos = [...direccion, permiso('academico.leer')]
    expect(rutaDeDestino('academico', 'direccion', permisos, ids)).toBe(
      `/academico?nivel=${ids.nivel}&anio=${ids.anio}&division=${ids.division}`,
    )
  })

  it('descarta filtros que no son ids o que la pantalla no usa', () => {
    const permisos = [...direccion, permiso('academico.leer')]
    expect(
      rutaDeDestino('academico', 'direccion', permisos, { nivel: 'primario', otro: 'x' }),
    ).toBe('/academico')
    expect(
      rutaDeDestino('deuda_por_familia', 'direccion', direccion, {
        nivel: '11111111-1111-4111-8111-111111111111',
      }),
    ).toBe('/facturacion/deudas/familias')
  })

  it('rechaza claves desconocidas y URLs armadas por el modelo', () => {
    expect(rutaDeDestino('https://evil.test', 'direccion', direccion)).toBeNull()
    expect(rutaDeDestino('/facturacion', 'direccion', direccion)).toBeNull()
    expect(rutaDeDestino('__proto__', 'direccion', direccion)).toBeNull()
  })

  it('todas las rutas del mapa son internas', () => {
    for (const ruta of Object.values(RUTAS_DE_DESTINO)) {
      expect(ruta.startsWith('/')).toBe(true)
      expect(ruta.startsWith('//')).toBe(false)
    }
  })
})

describe('rutaDeEntidad', () => {
  it('arma las mismas rutas que el buscador global', () => {
    expect(rutaDeEntidad('ALUMNO', 'abc')).toBe('/familias-alumnos/alumnos/abc')
    expect(rutaDeEntidad('FAMILIA', 'abc')).toBe('/familias-alumnos/familias/abc')
  })

  it('escapa el id', () => {
    expect(rutaDeEntidad('ALUMNO', 'a/../b')).toBe('/familias-alumnos/alumnos/a%2F..%2Fb')
  })
})

describe('etiquetaDeDestino', () => {
  it('una clave desconocida no tiene etiqueta', () => {
    expect(etiquetaDeDestino('no_existe', null, [])).toBeNull()
  })
})

describe('etiquetaDePantalla', () => {
  const permisos = [permiso('academico.leer'), permiso('facturacion.leer')]

  it('usa el nombre del menú de la pantalla en que está', () => {
    const academico = etiquetaDeDestino('academico', 'direccion', permisos)
    expect(academico).not.toBeNull()
    expect(etiquetaDePantalla('/academico', 'direccion', permisos)).toBe(academico)
  })

  it('en una subpantalla gana la entrada más específica', () => {
    const historial = etiquetaDeDestino('historial_asistencia', 'direccion', permisos)
    expect(historial).not.toBeNull()
    expect(etiquetaDePantalla('/academico/historial-asistencia', 'direccion', permisos)).toBe(
      historial,
    )
  })

  it('una pantalla anidada sin entrada propia usa la del módulo', () => {
    expect(etiquetaDePantalla('/academico/algo/mas', 'direccion', permisos)).toBe(
      etiquetaDePantalla('/academico', 'direccion', permisos),
    )
  })

  it('sin permiso o fuera del menú no hay pantalla', () => {
    expect(etiquetaDePantalla('/academico', 'direccion', [])).toBeNull()
    expect(etiquetaDePantalla('/no-existe', 'direccion', permisos)).toBeNull()
  })

  it('no confunde rutas que solo comparten el comienzo', () => {
    expect(etiquetaDePantalla('/academicos', 'direccion', permisos)).toBeNull()
  })
})
