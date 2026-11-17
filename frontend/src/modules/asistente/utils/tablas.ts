import type { AliasResuelto, ColumnaTabla, ValorCelda } from '../types'
import { etiquetaGenerica } from './alias'

export function formatearCelda(
  valor: string | number | null,
  tipo: 'texto' | 'numero' | 'moneda' | 'porcentaje' | 'alias',
): string {
  if (valor === null) return tipo === 'porcentaje' ? 'Sin registros' : '—'
  if (typeof valor === 'string') return valor
  if (tipo === 'moneda') {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(valor)
  }
  if (tipo === 'porcentaje') return `${valor.toLocaleString('es-AR')} %`
  return valor.toLocaleString('es-AR')
}

export type OrdenTabla = { clave: string; dir: 'asc' | 'desc' }

/** Ciclo del encabezado: sin orden, ascendente, descendente y de vuelta a sin orden. */
export function siguienteOrden(actual: OrdenTabla | null, clave: string): OrdenTabla | null {
  if (actual?.clave !== clave) return { clave, dir: 'asc' }
  return actual.dir === 'asc' ? { clave, dir: 'desc' } : null
}

/** Filas ordenadas por una columna: los números como números, el texto y los alias (por nombre
 * si ya se resolvió) con `localeCompare`. Los vacíos van siempre al final. No muta `filas`. */
export function ordenarFilas(
  filas: Record<string, ValorCelda>[],
  columna: ColumnaTabla,
  dir: 'asc' | 'desc',
  porAlias: Record<string, AliasResuelto>,
): Record<string, ValorCelda>[] {
  const numerica =
    columna.tipo === 'numero' || columna.tipo === 'moneda' || columna.tipo === 'porcentaje'
  const signo = dir === 'asc' ? 1 : -1
  const clave = (fila: Record<string, ValorCelda>): ValorCelda => {
    const valor = fila[columna.clave] ?? null
    if (columna.tipo === 'alias' && typeof valor === 'string')
      return porAlias[valor]?.nombre ?? valor
    return valor
  }
  return [...filas].sort((a, b) => {
    const va = clave(a)
    const vb = clave(b)
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1
    if (numerica && typeof va === 'number' && typeof vb === 'number') return (va - vb) * signo
    return String(va).localeCompare(String(vb), 'es-AR', { numeric: true }) * signo
  })
}

/** Columnas de variación o diferencia contra un período anterior: suben bien, bajan mal. */
export function esColumnaDeCambio(columna: ColumnaTabla): boolean {
  return columna.clave.startsWith('variacion') || columna.clave.startsWith('diferencia')
}

/** Variación sin signo (la dirección la dan la flecha y el color): `12,5 %`. */
export function formatearVariacion(variacion: number): string {
  return `${Math.abs(variacion).toLocaleString('es-AR')} %`
}

/** Texto de una celda, con el nombre real en las columnas de alias. */
export function textoDeCelda(
  columna: ColumnaTabla,
  valor: ValorCelda,
  porAlias: Record<string, AliasResuelto>,
): string {
  if (columna.tipo === 'alias' && typeof valor === 'string') {
    return porAlias[valor]?.nombre ?? etiquetaGenerica(valor)
  }
  return formatearCelda(valor, columna.tipo)
}
