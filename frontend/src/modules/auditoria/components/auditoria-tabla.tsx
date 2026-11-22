import { formatearFechaHora } from '@/lib/fechas'
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
import type { AuditoriaItem } from '@/modules/auditoria/types'
import {
  esAccion,
  etiquetaAccion,
  etiquetaEntidad,
  formatearCampo,
  nombreActor,
} from '@/modules/auditoria/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-28', anchoAlt: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-24', anchoAlt: 'h-4 w-20' },
  { tipo: 'texto', ancho: 'h-4 w-32', anchoAlt: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-20', anchoAlt: 'h-4 w-24' },
]

interface AuditoriaTablaProps {
  items: AuditoriaItem[]
  cargando: boolean
  pagina: number
  tamanioPagina: number
  total: number
  totalPaginas: number
  onCambiarPagina: (pagina: number) => void
  onVerDetalle: (item: AuditoriaItem) => void
}

export function AuditoriaTabla({
  items,
  cargando,
  pagina,
  tamanioPagina,
  total,
  totalPaginas,
  onCambiarPagina,
  onVerDetalle,
}: AuditoriaTablaProps) {
  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      {/* Un ancho mínimo real (no `min-w-0`) hace que en pantallas angostas la tabla scrollee en
          horizontal, en vez de aplastar las columnas y que un nombre largo pise la acción. */}
      <Table bare minWidth="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Entidad</TableHead>
            <TableHead>Quién</TableHead>
            <TableHead>Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando ? (
            <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={tamanioPagina} />
          ) : (
            items.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => onVerDetalle(item)}
                onKeyDown={(evento) => {
                  if (evento.target === evento.currentTarget && evento.key === 'Enter') {
                    onVerDetalle(item)
                  }
                }}
              >
                <TableCell className="whitespace-nowrap tabular-nums text-texto-2">
                  {formatearFechaHora(item.fecha)}
                </TableCell>
                <TableCell
                  className="max-w-[14rem] truncate font-medium"
                  title={etiquetaEntidad(item.entidad)}
                >
                  {etiquetaEntidad(item.entidad)}
                </TableCell>
                <TableCell
                  className="max-w-[16rem] truncate text-texto-2"
                  title={item.usuario_email ?? undefined}
                >
                  {nombreActor(item)}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="cursor-pointer text-left font-medium text-texto underline-offset-4 hover:underline"
                    title={esAccion(item.campo) ? undefined : formatearCampo(item.campo)}
                    aria-label={`Ver detalle: ${etiquetaAccion(item.campo)} de ${etiquetaEntidad(
                      item.entidad,
                    )}`}
                    onClick={(evento) => {
                      evento.stopPropagation()
                      onVerDetalle(item)
                    }}
                  >
                    {etiquetaAccion(item.campo)}
                  </button>
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
          etiqueta="registros"
        />
      )}
    </div>
  )
}
