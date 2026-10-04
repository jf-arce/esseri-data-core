import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DeudaFamilia, EstadoDeudaFamilia } from '@/modules/facturacion/types'
import { etiquetaEstadoFactura, formatearMoneda } from '@/modules/facturacion/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-40', anchoAlt: 'h-4 w-28' },
  { tipo: 'texto', ancho: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-14' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
  { tipo: 'chip', ancho: 'w-24', anchoAlt: 'w-20' },
]

const VARIANTE_ESTADO: Record<EstadoDeudaFamilia, 'advertencia' | 'error' | 'exito'> = {
  pendiente: 'advertencia',
  vencida: 'error',
  pagada: 'exito',
}

interface DeudaFamiliasTablaProps {
  items: DeudaFamilia[]
  cargando: boolean
  pagina: number
  tamanioPagina: number
  total: number
  onCambiarPagina: (pagina: number) => void
}

export function DeudaFamiliasTabla({
  items,
  cargando,
  pagina,
  tamanioPagina,
  total,
  onCambiarPagina,
}: DeudaFamiliasTablaProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanioPagina))

  return (
    <div className="rounded-panel bg-superficie shadow-card">
      <Table bare minWidth="min-w-[1050px]" className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-56">Responsable económico</TableHead>
            <TableHead className="w-28">DNI</TableHead>
            <TableHead className="w-28" data-align="end">
              Facturas
            </TableHead>
            <TableHead className="w-32" data-align="end">
              Pendiente
            </TableHead>
            <TableHead className="w-32" data-align="end">
              Vencido
            </TableHead>
            <TableHead className="w-32" data-align="end">
              Pagado
            </TableHead>
            <TableHead className="w-32" data-align="end">
              Deuda total
            </TableHead>
            <TableHead className="w-28">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando ? (
            <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={tamanioPagina} />
          ) : (
            items.map((deuda) => (
              <TableRow key={deuda.familia_id}>
                <TableCell className="truncate">
                  <Link
                    to={`/familias-alumnos/familias/${deuda.familia_id}`}
                    className="font-medium hover:text-violeta hover:underline"
                  >
                    {deuda.familia_apellido}, {deuda.familia_nombre}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">{deuda.familia_dni}</TableCell>
                <TableCell data-align="end" className="tabular-nums text-texto-2">
                  {deuda.facturas_pendientes} pendientes · {deuda.facturas_pagadas} pagadas
                </TableCell>
                <TableCell data-align="end" className="tabular-nums">
                  {formatearMoneda(deuda.monto_pendiente)}
                </TableCell>
                <TableCell data-align="end" className="font-medium tabular-nums text-error">
                  {formatearMoneda(deuda.monto_vencido)}
                </TableCell>
                <TableCell data-align="end" className="tabular-nums text-exito">
                  {formatearMoneda(deuda.monto_pagado)}
                </TableCell>
                <TableCell data-align="end" className="font-semibold tabular-nums">
                  {formatearMoneda(deuda.deuda_total)}
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_ESTADO[deuda.estado]}>
                    {etiquetaEstadoFactura(deuda.estado)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {!cargando && (
        <PaginadorServidor
          pagina={pagina}
          tamanioPagina={tamanioPagina}
          total={total}
          totalPaginas={totalPaginas}
          onCambiarPagina={onCambiarPagina}
          etiqueta="responsables"
        />
      )}
    </div>
  )
}
