import { DownloadIcon } from 'lucide-react'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { FilterBar, FilterSearch } from '@/components/filter-bar'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  BadgeEstadoDetalle,
  etiquetaResultado,
} from '@/modules/facturacion/components/debitos-etiquetas'
import type {
  ImportacionDetalleDebito,
  ImportacionResumenDebitos,
  ResultadoImportacionFiltro,
} from '@/modules/facturacion/types'
import { formatearMoneda } from '@/modules/facturacion/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-32', anchoAlt: 'h-4 w-24' },
  { tipo: 'chip', ancho: 'w-20' },
  { tipo: 'texto', ancho: 'h-4 w-48', anchoAlt: 'h-4 w-36' },
  { tipo: 'chip', ancho: 'w-20' },
  { tipo: 'texto', ancho: 'h-4 w-24' },
]

interface DebitosImportacionTablaProps {
  items: ImportacionDetalleDebito[]
  resumen: ImportacionResumenDebitos
  cargando: boolean
  resultado: ResultadoImportacionFiltro
  buscar: string
  pagina: number
  tamanio: number
  total: number
  descargando: boolean
  onResultadoChange: (resultado: ResultadoImportacionFiltro) => void
  onBuscarChange: (buscar: string) => void
  onCambiarPagina: (pagina: number) => void
  onDescargarIncidencias: () => void
}

export function DebitosImportacionTabla({
  items,
  resumen,
  cargando,
  resultado,
  buscar,
  pagina,
  tamanio,
  total,
  descargando,
  onResultadoChange,
  onBuscarChange,
  onCambiarPagina,
  onDescargarIncidencias,
}: DebitosImportacionTablaProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanio))
  const revision = resumen.rechazados.cantidad + resumen.errores.cantidad

  return (
    <div className="min-w-0 w-full rounded-panel bg-superficie shadow-card">
      <div className="flex flex-wrap items-end gap-3 border-b border-borde p-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-sm font-semibold text-texto">Detalle a revisar</h2>
          <ToggleGroup
            type="single"
            className="max-w-full flex-wrap"
            value={resultado}
            onValueChange={(valor) => {
              if (valor) onResultadoChange(valor as ResultadoImportacionFiltro)
            }}
          >
            <ToggleGroupItem value="revision">Requieren revisión · {revision}</ToggleGroupItem>
            <ToggleGroupItem value="rechazados">
              Rechazados · {resumen.rechazados.cantidad}
            </ToggleGroupItem>
            <ToggleGroupItem value="errores">Errores · {resumen.errores.cantidad}</ToggleGroupItem>
            <ToggleGroupItem value="cobrados">
              Cobrados · {resumen.cobrados.cantidad}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <FilterBar className="flex-1 justify-end">
          <FilterSearch
            value={buscar}
            onChange={onBuscarChange}
            placeholder="Buscar factura o alumno"
          />
        </FilterBar>
      </div>

      {!cargando && items.length === 0 ? (
        <Empty className="py-10">
          <EmptyTitle>No hay registros para este filtro.</EmptyTitle>
          <EmptyDescription>
            Probá con otro resultado o limpiá la búsqueda para ver el resto de la importación.
          </EmptyDescription>
        </Empty>
      ) : (
        <Table bare minWidth="min-w-[960px]" className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead>Factura</TableHead>
              <TableHead>Alumno</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Motivo informado</TableHead>
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
              items.map((item) => (
                <TableRow key={`${item.linea}-${item.referencia ?? ''}`}>
                  <TableCell className="font-medium tabular-nums">
                    <span
                      className="block max-w-32 truncate"
                      title={item.numero_factura ?? undefined}
                    >
                      {item.numero_factura ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className="block max-w-44 truncate"
                      title={item.alumno_nombre ?? undefined}
                    >
                      {item.alumno_nombre ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.estado === 'error'
                      ? 'Error'
                      : item.estado === 'duplicado'
                        ? 'Duplicado'
                        : etiquetaResultado(item.resultado)}
                  </TableCell>
                  <TableCell className="max-w-80 whitespace-normal break-words">
                    {item.mensaje}
                  </TableCell>
                  <TableCell>
                    <BadgeEstadoDetalle estado={item.estado} />
                  </TableCell>
                  <TableCell data-align="end" className="font-medium">
                    {item.importe ? formatearMoneda(item.importe) : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={descargando}
          onClick={onDescargarIncidencias}
        >
          <DownloadIcon data-icon="inline-start" />
          Descargar rechazados y errores (CSV)
        </Button>
        {!cargando && (
          <PaginadorServidor
            pagina={pagina}
            tamanioPagina={tamanio}
            total={total}
            totalPaginas={totalPaginas}
            onCambiarPagina={onCambiarPagina}
            etiqueta="registros"
          />
        )}
      </div>
    </div>
  )
}
