import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, DownloadIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { descargarTabla, type FormatoTabla } from '../services/exportar-tabla'
import type { AliasResuelto, BloqueTabla } from '../types'
import { ordenarFilas, siguienteOrden, textoDeCelda, type OrdenTabla } from '../utils'

interface BloqueTablaProps {
  bloque: BloqueTabla
  porAlias: Record<string, AliasResuelto>
  /** Sin conversación guardada no hay nada que descargar. */
  conversacionId?: string | null
}

export function BloqueTablaVista({ bloque, porAlias, conversacionId = null }: BloqueTablaProps) {
  const [orden, setOrden] = useState<OrdenTabla | null>(null)
  const [descargando, setDescargando] = useState(false)

  const filas = useMemo(() => {
    const columna = bloque.columnas.find((c) => c.clave === orden?.clave)
    if (orden === null || columna === undefined) return bloque.filas
    return ordenarFilas(bloque.filas, columna, orden.dir, porAlias)
  }, [bloque, orden, porAlias])

  async function descargar(formato: FormatoTabla) {
    if (conversacionId === null) return
    setDescargando(true)
    try {
      await descargarTabla(conversacionId, bloque.tabla_id, formato)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo descargar la tabla.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <figure className="rounded-xl border border-borde bg-superficie">
      <figcaption className="flex items-center justify-between gap-2 px-3 pt-3">
        <span className="text-sm font-medium text-texto">{bloque.titulo}</span>
        {conversacionId !== null && bloque.filas.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={descargando}
                aria-label="Descargar la tabla"
              >
                <DownloadIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void descargar('csv')}>
                Descargar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void descargar('xlsx')}>
                Descargar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </figcaption>
      {bloque.filas.length === 0 ? (
        <p className="px-3 py-4 text-sm text-texto-3">Sin registros en este período.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {bloque.columnas.map((columna) => {
                const derecha = columna.tipo !== 'texto' && columna.tipo !== 'alias'
                const activo = orden?.clave === columna.clave ? orden.dir : null
                return (
                  <TableHead
                    key={columna.clave}
                    className={cn(derecha && 'text-right')}
                    aria-sort={
                      activo === 'asc' ? 'ascending' : activo === 'desc' ? 'descending' : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setOrden((actual) => siguienteOrden(actual, columna.clave))}
                      className={cn(
                        'flex cursor-pointer items-center gap-1 hover:text-texto',
                        derecha && 'ml-auto',
                      )}
                    >
                      {columna.etiqueta}
                      {activo === 'asc' && <ArrowUpIcon className="size-3.5" />}
                      {activo === 'desc' && <ArrowDownIcon className="size-3.5" />}
                      {activo === null && <ArrowUpDownIcon className="size-3.5 opacity-40" />}
                    </button>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((fila, indice) => (
              <TableRow key={indice}>
                {bloque.columnas.map((columna) => {
                  const valor = fila[columna.clave] ?? null
                  const texto = textoDeCelda(columna, valor, porAlias)
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
