import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { descargarTabla, type FormatoTabla } from '../services/exportar-tabla'
import { ALTO_FILA_TABLA, FILAS_VISIBLES_TABLA, MS_FEEDBACK_COPIA } from '../constants'
import { copiarAlPortapapeles } from '../services/portapapeles'
import type { AliasResuelto, BloqueTabla } from '../types'
import {
  armarCopiaTabla,
  esColumnaDeCambio,
  ordenarFilas,
  siguienteOrden,
  textoDeCelda,
  type OrdenTabla,
} from '../utils'

interface BloqueTablaProps {
  bloque: BloqueTabla
  porAlias: Record<string, AliasResuelto>
  /** Sin conversación guardada no hay nada que descargar. */
  conversacionId?: string | null
}

export function BloqueTablaVista({ bloque, porAlias, conversacionId = null }: BloqueTablaProps) {
  const [orden, setOrden] = useState<OrdenTabla | null>(null)
  const [descargando, setDescargando] = useState(false)
  const [copiada, setCopiada] = useState(false)

  useEffect(() => {
    if (!copiada) return
    const espera = window.setTimeout(() => setCopiada(false), MS_FEEDBACK_COPIA)
    return () => window.clearTimeout(espera)
  }, [copiada])

  const filas = useMemo(() => {
    const columna = bloque.columnas.find((c) => c.clave === orden?.clave)
    if (orden === null || columna === undefined) return bloque.filas
    return ordenarFilas(bloque.filas, columna, orden.dir, porAlias)
  }, [bloque, orden, porAlias])

  async function copiar() {
    try {
      // Se copia en el orden que se está viendo.
      const { texto, html } = armarCopiaTabla({ ...bloque, filas }, porAlias)
      await copiarAlPortapapeles(texto, html)
      setCopiada(true)
    } catch {
      toast.error('No se pudo copiar la tabla.')
    }
  }

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

  // Con más filas que las visibles, la tabla scrollea por dentro con el encabezado fijo.
  const conScroll = filas.length > FILAS_VISIBLES_TABLA
  const altoMaximo = (FILAS_VISIBLES_TABLA + 1) * ALTO_FILA_TABLA

  return (
    <figure className="rounded-xl border border-borde bg-superficie">
      <figcaption className="flex items-center justify-between gap-2 px-3 pt-3">
        <span className="text-sm font-medium text-texto">{bloque.titulo}</span>
        {bloque.filas.length > 0 && (
          <div className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void copiar()}
                  aria-label={copiada ? 'Tabla copiada' : 'Copiar la tabla'}
                >
                  {copiada ? <CheckIcon /> : <CopyIcon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copiada ? 'Copiada' : 'Copiar tabla'}</TooltipContent>
            </Tooltip>
            {conversacionId !== null && (
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
                  <DropdownMenuItem onSelect={() => void descargar('xlsx')}>
                    Descargar Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void descargar('csv')}>
                    Descargar CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </figcaption>
      {bloque.filas.length === 0 ? (
        <p className="px-3 py-4 text-sm text-texto-3">Sin registros en este período.</p>
      ) : (
        <Table
          containerClassName={cn(conScroll && 'overflow-y-auto')}
          containerStyle={conScroll ? { maxHeight: altoMaximo } : undefined}
        >
          <TableHeader className={cn(conScroll && 'sticky top-0 z-10 bg-superficie')}>
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
                  const cambio = esColumnaDeCambio(columna) && typeof valor === 'number' ? valor : 0
                  return (
                    <TableCell
                      key={columna.clave}
                      className={cn(
                        columna.tipo !== 'texto' &&
                          columna.tipo !== 'alias' &&
                          'text-right tabular-nums',
                        cambio > 0 && 'font-medium text-exito',
                        cambio < 0 && 'font-medium text-error',
                      )}
                    >
                      {cambio > 0 && '▲ '}
                      {cambio < 0 && '▼ '}
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
        {conScroll && `${filas.length} filas, deslizá para ver el resto. `}
        {bloque.periodo} · {bloque.fuente}
      </p>
    </figure>
  )
}
