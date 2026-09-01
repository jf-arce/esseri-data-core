import type { MouseEvent } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { paginasVisibles } from '@/lib/paginacion'
import {
  Pagination,
  PaginationContent,
  PaginationCount,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Badge } from '@/components/ui/badge'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { EstadoFactura, Factura } from '@/modules/facturacion/types'
import {
  etiquetaEstadoFactura,
  formatearFechaFactura,
  formatearMoneda,
} from '@/modules/facturacion/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-28', anchoAlt: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
  { tipo: 'texto', ancho: 'h-4 w-48', anchoAlt: 'h-4 w-36' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
  { tipo: 'chip', ancho: 'w-24', anchoAlt: 'w-20' },
]

const VARIANTE_ESTADO: Record<EstadoFactura, 'advertencia' | 'error' | 'exito'> = {
  pendiente: 'advertencia',
  vencida: 'error',
  pagada: 'exito',
}

interface FacturasTablaProps {
  items: Factura[]
  cargando: boolean
  pagina: number
  tamanioPagina: number
  total: number
  onCambiarPagina: (pagina: number) => void
}

export function FacturasTabla({
  items,
  cargando,
  pagina,
  tamanioPagina,
  total,
  onCambiarPagina,
}: FacturasTablaProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanioPagina))
  const primeraFila = (pagina - 1) * tamanioPagina + 1
  const ultimaFila = Math.min(total, pagina * tamanioPagina)
  const irA = (destino: number) => (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.preventDefault()
    if (destino >= 1 && destino <= totalPaginas) onCambiarPagina(destino)
  }

  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <Table bare minWidth="min-w-[780px]">
        <TableHeader>
          <TableRow>
            <TableHead>Factura</TableHead>
            <TableHead>Emisión</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead>Conceptos</TableHead>
            <TableHead data-align="end">Total</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando ? (
            <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={tamanioPagina} />
          ) : (
            items.map((factura) => (
              <TableRow key={factura.id}>
                <TableCell>
                  <Link
                    to={`/facturacion/${factura.id}`}
                    className="font-medium tabular-nums hover:text-violeta hover:underline"
                  >
                    #{factura.id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatearFechaFactura(factura.fecha_emision)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatearFechaFactura(factura.fecha_vencimiento)}
                </TableCell>
                <TableCell>
                  <span className="line-clamp-1 max-w-[320px]">
                    {factura.detalles.map((detalle) => detalle.descripcion).join(' · ')}
                  </span>
                </TableCell>
                <TableCell data-align="end" className="font-medium tabular-nums">
                  {formatearMoneda(Number(factura.monto_total))}
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_ESTADO[factura.estado]}>
                    {etiquetaEstadoFactura(factura.estado)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {!cargando && total > 0 && (
        <Pagination>
          <PaginationCount>
            {primeraFila}-{ultimaFila} de {total} facturas
          </PaginationCount>
          {totalPaginas > 1 && (
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  text=""
                  onClick={irA(pagina - 1)}
                  aria-disabled={pagina === 1}
                  tabIndex={pagina === 1 ? -1 : 0}
                  className={cn(pagina === 1 && 'pointer-events-none opacity-40')}
                />
              </PaginationItem>
              {paginasVisibles(totalPaginas, pagina).map((item, indice) =>
                item === 'elipsis' ? (
                  <PaginationItem key={`elipsis-${indice}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink isActive={item === pagina} onClick={irA(item)}>
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  text=""
                  onClick={irA(pagina + 1)}
                  aria-disabled={pagina === totalPaginas}
                  tabIndex={pagina === totalPaginas ? -1 : 0}
                  className={cn(pagina === totalPaginas && 'pointer-events-none opacity-40')}
                />
              </PaginationItem>
            </PaginationContent>
          )}
        </Pagination>
      )}
    </div>
  )
}
