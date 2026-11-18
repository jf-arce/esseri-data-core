import { describe, expect, it } from 'vitest'
import type { BloqueTabla } from '../../types'
import { armarCopia, armarCopiaTabla } from '../copia'

describe('armarCopia', () => {
  const tabla = {
    tipo: 'tabla' as const,
    tabla_id: 't',
    titulo: 'Deuda por familia',
    columnas: [
      { clave: 'familia', etiqueta: 'Familia', tipo: 'alias' as const },
      { clave: 'vencido', etiqueta: 'Vencido', tipo: 'moneda' as const },
    ],
    filas: [{ familia: '[FAMILIA:1]', vencido: 1560000 }],
    periodo: 'al 13/11/2026',
    fuente: 'Cuenta corriente',
  }
  const porAlias = {
    '[FAMILIA:1]': {
      alias: '[FAMILIA:1]',
      tipo: 'FAMILIA' as const,
      entidad_id: 'f1',
      nombre: 'Torres, Andrés',
    },
  }

  it('incluye la tabla con tabuladores y el nombre real', () => {
    const { texto } = armarCopia('Hay 12 familias.', [tabla], porAlias)
    expect(texto).toContain('Hay 12 familias.')
    expect(texto).toContain('Familia\tVencido')
    expect(texto).toContain('Torres, Andrés\t$')
    expect(texto).toContain('al 13/11/2026 · Cuenta corriente')
  })

  it('arma una tabla html y escapa el contenido', () => {
    const { html } = armarCopia('a < b', [tabla], porAlias)
    expect(html).toContain('<p>a &lt; b</p>')
    expect(html).toContain('<th>Familia</th>')
    expect(html).toContain('<td>Torres, Andrés</td>')
  })

  it('incluye los indicadores', () => {
    const kpi = {
      tipo: 'kpi' as const,
      titulo: 'Alumnos activos',
      valor: 320,
      unidad: '',
      periodo: 'al 13/11/2026',
      fuente: 'Inscripciones',
    }
    expect(armarCopia('Listo.', [kpi], {}).texto).toContain(
      'Alumnos activos: 320 (al 13/11/2026 · Inscripciones)',
    )
  })
})

describe('armarCopiaTabla', () => {
  const bloque: BloqueTabla = {
    tipo: 'tabla',
    tabla_id: 't',
    titulo: 'Deuda por familia',
    columnas: [
      { clave: 'familia', etiqueta: 'Familia', tipo: 'alias' },
      { clave: 'monto', etiqueta: 'Monto', tipo: 'moneda' },
    ],
    filas: [{ familia: '[FAMILIA:1]', monto: 1000 }],
    periodo: 'al 17/11/2026',
    fuente: 'Cuenta corriente',
  }

  it('trae solo el encabezado y las filas, con el nombre real en los alias', () => {
    const porAlias = {
      '[FAMILIA:1]': {
        alias: '[FAMILIA:1]',
        tipo: 'FAMILIA',
        entidad_id: 'f1',
        nombre: 'Pérez, Ana',
      },
    } as const
    const { texto, html } = armarCopiaTabla(bloque, porAlias)
    expect(texto.split('\n')).toHaveLength(2)
    expect(texto).toContain('Familia\tMonto')
    expect(texto).toContain('Pérez, Ana')
    expect(texto).not.toContain('Deuda por familia')
    expect(texto).not.toContain('Cuenta corriente')
    expect(html.startsWith('<table>')).toBe(true)
  })
})
