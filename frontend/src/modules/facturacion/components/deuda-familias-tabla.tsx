import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  { tipo: 'texto', ancho: 'h-4 w-24', clase: 'hidden 2xl:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-14', clase: 'hidden 2xl:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-20', clase: 'hidden xl:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-20', clase: 'hidden xl:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-20', clase: 'hidden 2xl:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-20', clase: 'hidden lg:table-cell' },
  { tipo: 'chip', ancho: 'w-24', anchoAlt: 'w-20' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
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
  onVerProrrogas: (deuda: DeudaFamilia) => void
}

export function DeudaFamiliasTabla({
  items,
  cargando,
  pagina,
  tamanioPagina,
  total,
  onCambiarPagina,
  onVerProrrogas,
}: DeudaFamiliasTablaProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanioPagina))

  return (
    <div className="rounded-panel bg-superficie shadow-card">
      <Table bare minWidth="min-w-0">
        <TableHeader>
          <TableRow>
            <TableHead className="lg:w-56">
              <span className="lg:hidden">Responsable</span>
              <span className="max-lg:hidden">Responsable económico</span>
            </TableHead>
            <TableHead className="hidden w-28 2xl:table-cell">DNI</TableHead>
            <TableHead className="hidden w-28 2xl:table-cell" data-align="end">
              Facturas
            </TableHead>
            <TableHead className="hidden w-32 xl:table-cell" data-align="end">
              Pendiente
            </TableHead>
            <TableHead className="hidden w-32 xl:table-cell" data-align="end">
              Vencido
            </TableHead>
            <TableHead className="hidden w-32 2xl:table-cell" data-align="end">
              Pagado
            </TableHead>
            <TableHead className="hidden w-32 lg:table-cell" data-align="end">
              Deuda total
            </TableHead>
            <TableHead className="lg:w-28">Estado</TableHead>
            <TableHead className="px-2 sm:px-4 lg:w-28" data-align="end">
              <span className="max-lg:sr-only">Prórrogas</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando ? (
            <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={tamanioPagina} />
          ) : (
            items.map((deuda) => (
              <TableRow key={deuda.familia_id}>
                <TableCell className="max-w-[12rem] whitespace-normal md:max-w-[14rem] md:truncate md:whitespace-nowrap">
                  <Link
                    to={`/familias-alumnos/familias/${deuda.familia_id}`}
                    className="font-medium hover:text-violeta hover:underline"
                  >
                    {deuda.familia_apellido}, {deuda.familia_nombre}
                  </Link>
                </TableCell>
                <TableCell className="hidden tabular-nums 2xl:table-cell">
                  {deuda.familia_dni}
                </TableCell>
                <TableCell
                  data-align="end"
                  className="hidden tabular-nums text-texto-2 2xl:table-cell"
                >
                  {deuda.facturas_pendientes} impagas · {deuda.facturas_pagadas} pagadas
                </TableCell>
                <TableCell data-align="end" className="hidden tabular-nums xl:table-cell">
                  {formatearMoneda(deuda.monto_pendiente)}
                </TableCell>
                <TableCell
                  data-align="end"
                  className="hidden font-medium tabular-nums text-error xl:table-cell"
                >
                  {formatearMoneda(deuda.monto_vencido)}
                </TableCell>
                <TableCell
                  data-align="end"
                  className="hidden tabular-nums text-exito 2xl:table-cell"
                >
                  {formatearMoneda(deuda.monto_pagado)}
                </TableCell>
                <TableCell
                  data-align="end"
                  className="hidden font-semibold tabular-nums lg:table-cell"
                >
                  {formatearMoneda(deuda.deuda_total)}
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_ESTADO[deuda.estado]}>
                    {etiquetaEstadoFactura(deuda.estado)}
                  </Badge>
                </TableCell>
                <TableCell data-align="end" className="px-2 sm:px-4">
                  <Button variant="ghost" size="sm" onClick={() => onVerProrrogas(deuda)}>
                    Ver
                  </Button>
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
