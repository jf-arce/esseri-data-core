import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { AliasResuelto, BloqueTabla } from '../types'
import { etiquetaGenerica, formatearCelda } from '../utils'

interface BloqueTablaProps {
  bloque: BloqueTabla
  porAlias: Record<string, AliasResuelto>
}

export function BloqueTablaVista({ bloque, porAlias }: BloqueTablaProps) {
  return (
    <figure className="rounded-xl border border-borde bg-superficie">
      <figcaption className="px-3 pt-3 text-sm font-medium text-texto">{bloque.titulo}</figcaption>
      {bloque.filas.length === 0 ? (
        <p className="px-3 py-4 text-sm text-texto-3">Sin registros en este período.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {bloque.columnas.map((columna) => (
                <TableHead
                  key={columna.clave}
                  className={cn(
                    columna.tipo !== 'texto' && columna.tipo !== 'alias' && 'text-right',
                  )}
                >
                  {columna.etiqueta}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {bloque.filas.map((fila, indice) => (
              <TableRow key={indice}>
                {bloque.columnas.map((columna) => {
                  const valor = fila[columna.clave] ?? null
                  const texto =
                    columna.tipo === 'alias' && typeof valor === 'string'
                      ? (porAlias[valor]?.nombre ?? etiquetaGenerica(valor))
                      : formatearCelda(valor, columna.tipo)
                  return (
                    <TableCell
                      key={columna.clave}
                      className={cn(
                        columna.tipo !== 'texto' &&
                          columna.tipo !== 'alias' &&
                          'text-right tabular-nums',
                      )}
                    >
                      {texto}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="px-3 pt-1 pb-3 text-xs text-texto-3">
        {bloque.periodo} · {bloque.fuente}
      </p>
    </figure>
  )
}
