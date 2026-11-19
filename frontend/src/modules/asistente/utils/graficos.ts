import type { AliasResuelto, BloqueGrafico, BloqueTabla, ColumnaTabla } from '../types'

export type PuntoGrafico = Record<string, string | number | null>

/**
 * Filas del gráfico, tomadas de su tabla: el eje X como texto y las series como números. Si el
 * eje es una columna de alias, muestra el nombre resuelto en vez del `[FAMILIA:1]`.
 */
export function datosDeGrafico(
  bloque: BloqueGrafico,
  tabla: BloqueTabla,
  porAlias: Record<string, AliasResuelto> = {},
): PuntoGrafico[] {
  const ejeEsAlias = tabla.columnas.some((c) => c.clave === bloque.eje_x && c.tipo === 'alias')
  return tabla.filas.map((fila) => {
    const crudo = String(fila[bloque.eje_x] ?? '')
    const etiqueta = ejeEsAlias ? (porAlias[crudo]?.nombre ?? crudo) : crudo
    const punto: PuntoGrafico = { [bloque.eje_x]: etiqueta }
    for (const clave of bloque.series) {
      const valor = fila[clave] ?? null
      punto[clave] = typeof valor === 'number' ? valor : null
    }
    return punto
  })
}

/** Marca del eje Y: los importes en formato compacto ($ 1,5 M) para que entren en el gráfico. */
export function formatearEjeY(valor: number, tipo: ColumnaTabla['tipo']): string {
  if (tipo === 'moneda') {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(valor)
  }
  if (tipo === 'porcentaje') return `${valor.toLocaleString('es-AR')} %`
  return valor.toLocaleString('es-AR')
}
