import { MoreHorizontalIcon } from 'lucide-react'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
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
import {
  BadgeEstadoLote,
  etiquetaPeriodo,
} from '@/modules/facturacion/components/debitos-etiquetas'
import type { LoteDebitoResumen } from '@/modules/facturacion/types'
import { formatearFechaFactura, formatearMoneda } from '@/modules/facturacion/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-32' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
  { tipo: 'texto', ancho: 'h-4 w-16' },
  { tipo: 'texto', ancho: 'h-4 w-10' },
  { tipo: 'texto', ancho: 'h-4 w-24' },
  { tipo: 'chip', ancho: 'w-36' },
  { tipo: 'accion' },
]

interface DebitosHistorialTablaProps {
  lotes: LoteDebitoResumen[]
  cargando: boolean
  pagina: number
  tamanio: number
  total: number
  onCambiarPagina: (pagina: number) => void
  onImportar: () => void
  onContinuarRevision: (importacionId: string) => void
  onVerDetalle: (loteId: string) => void
  onLiberar: (lote: LoteDebitoResumen) => void
}

export function DebitosHistorialTabla({
  lotes,
  cargando,
  pagina,
  tamanio,
  total,
  onCambiarPagina,
  onImportar,
  onContinuarRevision,
  onVerDetalle,
  onLiberar,
}: DebitosHistorialTablaProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanio))

  return (
    <div className="min-w-0 w-full rounded-panel bg-superficie shadow-card">
      <Table bare className="text-[13px]">
        <TableHeader>
          <TableRow>
            <TableHead>Lote</TableHead>
            <TableHead>Exportado</TableHead>
            <TableHead>Período</TableHead>
            <TableHead data-align="end">Facturas</TableHead>
            <TableHead data-align="end">Importe</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead data-align="end" className="w-10">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando ? (
            <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={tamanio} />
          ) : (
            lotes.map((lote) => (
              <TableRow key={lote.id}>
                <TableCell className="font-medium tabular-nums">
                  <span className="block max-w-40 truncate" title={lote.codigo}>
                    {lote.codigo}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatearFechaFactura(lote.fecha_exportacion)}
                </TableCell>
                <TableCell>{etiquetaPeriodo(lote.periodo)}</TableCell>
                <TableCell data-align="end">{lote.cantidad_facturas}</TableCell>
                <TableCell data-align="end" className="font-medium">
                  {formatearMoneda(lote.importe_total)}
                </TableCell>
                <TableCell>
                  <BadgeEstadoLote estado={lote.estado} compacto />
                </TableCell>
                <TableCell data-align="end" className="w-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Acciones del lote ${lote.codigo}`}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {lote.estado === 'exportado' && (
                        <DropdownMenuItem onClick={onImportar}>
                          Importar resultados
                        </DropdownMenuItem>
                      )}
                      {lote.estado === 'exportado' && !lote.resultados_importados && (
                        <DropdownMenuItem onClick={() => onLiberar(lote)}>
                          Liberar lote
                        </DropdownMenuItem>
                      )}
                      {lote.estado === 'en_revision' && lote.importacion_id && (
                        <DropdownMenuItem
                          onClick={() => onContinuarRevision(lote.importacion_id as string)}
                        >
                          Continuar revisión
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onVerDetalle(lote.id)}>
                        Ver detalle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {!cargando && (
        <PaginadorServidor
          pagina={pagina}
          tamanioPagina={tamanio}
          total={total}
          totalPaginas={totalPaginas}
          onCambiarPagina={onCambiarPagina}
          etiqueta="lotes"
        />
      )}
    </div>
  )
}
