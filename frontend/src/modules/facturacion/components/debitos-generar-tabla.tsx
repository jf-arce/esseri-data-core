import type { ReactNode } from 'react'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { FacturaElegibleDebito, ResumenSeleccionDebitos } from '@/modules/facturacion/types'
import { etiquetaMedio, etiquetaPeriodo } from '@/modules/facturacion/components/debitos-etiquetas'
import { formatearFechaFactura, formatearMoneda } from '@/modules/facturacion/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'checkbox' },
  { tipo: 'texto', ancho: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-40', anchoAlt: 'h-4 w-32' },
  { tipo: 'texto', ancho: 'h-4 w-14' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
  { tipo: 'chip', ancho: 'w-16' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
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
  onCambiarPagina: (pagina: number) => void
  onAlternarFila: (id: string, seleccionada: boolean) => void
  onAlternarTodasFiltradas: (seleccionada: boolean) => void
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
  onCambiarPagina,
  onAlternarFila,
  onAlternarTodasFiltradas,
}: DebitosGenerarTablaProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanio))
  const cantidadVisible = resumen.cantidad

  return (
    <div className="min-w-0 w-full rounded-panel bg-superficie shadow-card">
      <div className="border-b border-borde p-3">{filtros}</div>

      {resumen.cantidad > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-violeta-borde bg-violeta-suave px-4 py-2 text-sm text-texto">
          <p>
            Seleccionaste {cantidadVisible} {cantidadVisible === 1 ? 'factura' : 'facturas'}{' '}
            {modo === 'filtrados' ? 'que coinciden con los filtros.' : 'de esta página.'}
          </p>
        </div>
      )}

      {!cargando && facturas.length === 0 ? (
        <div className="p-6">{vacio}</div>
      ) : (
        <Table bare minWidth="min-w-[1040px]" className="text-[13px]">
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
              <TableHead>Curso</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Medio</TableHead>
              <TableHead>Vence</TableHead>
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
                      <span className="block max-w-32 truncate" title={factura.numero}>
                        {factura.numero}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-48 truncate" title={factura.alumno_nombre}>
                        {factura.alumno_nombre}
                      </span>
                    </TableCell>
                    <TableCell>{factura.curso}</TableCell>
                    <TableCell>{etiquetaPeriodo(factura.periodo)}</TableCell>
                    <TableCell>{etiquetaMedio(factura.medio)}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatearFechaFactura(factura.fecha_vencimiento)}
                    </TableCell>
                    <TableCell data-align="end" className="font-medium">
                      {formatearMoneda(factura.importe)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
          {!cargando && facturas.length > 0 && resumen.cantidad > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>Total de la selección</TableCell>
                <TableCell data-align="end" colSpan={2} className="font-semibold">
                  {formatearMoneda(resumen.importe_total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
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
