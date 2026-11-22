import type { ReactNode } from 'react'
import { DownloadIcon, EraserIcon } from 'lucide-react'
import { Link } from 'react-router'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { FacturaElegibleDebito, ResumenSeleccionDebitos } from '@/modules/facturacion/types'
import { formatearFechaFactura, formatearMoneda } from '@/modules/facturacion/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'checkbox' },
  { tipo: 'texto', ancho: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-40', anchoAlt: 'h-4 w-32' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
  { tipo: 'chip', ancho: 'w-20' },
  { tipo: 'texto', ancho: 'h-4 w-24' },
]

interface DebitosGenerarTablaProps {
  filtros: ReactNode
  vacio?: ReactNode
  facturas: FacturaElegibleDebito[]
  cargando: boolean
  pagina: number
  tamanio: number
  total: number
  resumen: ResumenSeleccionDebitos
  modo: 'pagina' | 'filtrados'
  seleccionadas: string[]
  excluidos: string[]
  estadoTodas: boolean | 'indeterminate'
  exportando: boolean
  onCambiarPagina: (pagina: number) => void
  onAlternarFila: (id: string, seleccionada: boolean) => void
  onAlternarTodasFiltradas: (seleccionada: boolean) => void
  onVerFactura: (factura: FacturaElegibleDebito) => void
  onExportar: () => void
  onLimpiar: () => void
}

export function DebitosGenerarTabla({
  filtros,
  vacio,
  facturas,
  cargando,
  pagina,
  tamanio,
  total,
  resumen,
  modo,
  seleccionadas,
  excluidos,
  estadoTodas,
  exportando,
  onCambiarPagina,
  onAlternarFila,
  onAlternarTodasFiltradas,
  onVerFactura,
  onExportar,
  onLimpiar,
}: DebitosGenerarTablaProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanio))
  const cantidadVisible = resumen.cantidad

  return (
    <div className="min-w-0 w-full rounded-panel bg-superficie shadow-card">
      <div className="border-b border-borde p-3">{filtros}</div>

      {resumen.cantidad > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-violeta-borde bg-violeta-suave px-4 py-2 text-sm text-texto">
          <div>
            <p className="font-medium tabular-nums">
              {cantidadVisible}{' '}
              {cantidadVisible === 1 ? 'factura seleccionada' : 'facturas seleccionadas'}
            </p>
            <p className="text-xs text-texto-2">
              Seleccionaste {cantidadVisible} {cantidadVisible === 1 ? 'factura' : 'facturas'}{' '}
              {modo === 'filtrados' ? 'que coinciden con los filtros.' : 'de esta página.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" disabled={exportando} onClick={onLimpiar}>
              <EraserIcon data-icon="inline-start" />
              Limpiar
            </Button>
            <Button disabled={exportando} onClick={onExportar}>
              <DownloadIcon data-icon="inline-start" />
              Exportar {cantidadVisible} solicitudes
            </Button>
          </div>
        </div>
      )}

      {!cargando && facturas.length === 0 ? (
        <div className="p-6">{vacio}</div>
      ) : (
        <Table bare minWidth="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  aria-label="Seleccionar todas las facturas que coinciden con los filtros"
                  checked={estadoTodas}
                  disabled={cargando || facturas.length === 0 || total === 0}
                  onCheckedChange={(valor) => onAlternarTodasFiltradas(valor === true)}
                />
              </TableHead>
              <TableHead>Factura</TableHead>
              <TableHead>Alumno</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead data-align="end" className="w-32">
                Importe
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={tamanio} />
            ) : (
              facturas.map((factura) => {
                const seleccionada =
                  modo === 'filtrados'
                    ? !excluidos.includes(factura.id)
                    : seleccionadas.includes(factura.id)
                return (
                  <TableRow key={factura.id} data-state={seleccionada ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Seleccionar ${factura.numero}`}
                        checked={seleccionada}
                        onCheckedChange={(valor) => onAlternarFila(factura.id, valor === true)}
                      />
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        title={`Ver detalle de ${factura.numero}`}
                        className="block max-w-32 truncate underline-offset-4 hover:underline"
                        onClick={() => onVerFactura(factura)}
                      >
                        {factura.numero}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/familias-alumnos/alumnos/${factura.alumno_id}`}
                        className="block max-w-48 truncate font-medium underline-offset-4 hover:underline"
                        title={factura.alumno_nombre}
                      >
                        {factura.alumno_nombre}
                      </Link>
                      <span className="block max-w-48 truncate text-xs text-texto-3">
                        {factura.curso}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatearFechaFactura(factura.fecha_vencimiento)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={factura.en_lote ? 'info' : 'neutro'}>
                        {factura.en_lote ? 'En lote' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                    <TableCell data-align="end" className="font-medium tabular-nums">
                      {formatearMoneda(factura.importe)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      )}

      {!cargando && facturas.length > 0 && (
        <PaginadorServidor
          pagina={pagina}
          tamanioPagina={tamanio}
          total={total}
          totalPaginas={totalPaginas}
          onCambiarPagina={onCambiarPagina}
          etiqueta="facturas"
        />
      )}
    </div>
  )
}
