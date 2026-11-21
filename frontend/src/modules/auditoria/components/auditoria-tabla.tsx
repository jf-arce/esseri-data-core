import { formatearFechaHora } from '@/lib/fechas'
import { EyeIcon } from 'lucide-react'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ValoresCambio } from '@/modules/auditoria/components/valores-cambio'
import type { AuditoriaItem } from '@/modules/auditoria/types'
import { etiquetaEntidad, formatearCampo } from '@/modules/auditoria/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-28', anchoAlt: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-24', anchoAlt: 'h-4 w-20' },
  { tipo: 'texto', ancho: 'h-4 w-20', anchoAlt: 'h-4 w-24' },
  { tipo: 'chips' },
  { tipo: 'texto', ancho: 'h-4 w-24', clase: 'hidden @5xl/main:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-24', clase: 'hidden @7xl/main:table-cell' },
  { tipo: 'accion' },
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
          horizontal, en vez de aplastar las columnas y que un valor largo pise al actor. */}
      <Table bare minWidth="min-w-[640px] @5xl/main:min-w-[880px]">
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Entidad</TableHead>
            <TableHead>Campo</TableHead>
            <TableHead>Cambio</TableHead>
            <TableHead className="hidden @5xl/main:table-cell">Actor</TableHead>
            <TableHead className="hidden @7xl/main:table-cell">Origen</TableHead>
            <TableHead data-align="end">
              <span className="sr-only">Acciones</span>
            </TableHead>
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
                <TableCell className="font-medium">
                  <span
                    className="block max-w-[10rem] truncate"
                    title={etiquetaEntidad(item.entidad)}
                  >
                    {etiquetaEntidad(item.entidad)}
                  </span>
                </TableCell>
                <TableCell className="text-texto-2">
                  <span className="block max-w-[10rem] truncate" title={formatearCampo(item.campo)}>
                    {formatearCampo(item.campo)}
                  </span>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="max-w-[22rem]">
                    <ValoresCambio
                      valorAnterior={item.valor_anterior}
                      valorNuevo={item.valor_nuevo}
                      truncar
                    />
                  </div>
                </TableCell>
                <TableCell className="hidden @5xl/main:table-cell">
                  <div className="flex max-w-[13rem] flex-col items-start gap-1">
                    <Badge variant={item.actor_tipo === 'sistema' ? 'neutro' : 'info'}>
                      {item.actor_tipo === 'sistema' ? 'Sistema' : 'Usuario'}
                    </Badge>
                    {item.usuario_email && (
                      <span
                        className="max-w-full min-w-0 truncate text-xs text-texto-3"
                        title={item.usuario_email}
                      >
                        {item.usuario_email}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden text-texto-2 @7xl/main:table-cell">
                  <span
                    className="block max-w-[8rem] truncate"
                    title={item.origen ? formatearCampo(item.origen) : undefined}
                  >
                    {item.origen ? formatearCampo(item.origen) : '—'}
                  </span>
                </TableCell>
                <TableCell data-align="end" className="px-2 @xl/main:px-4">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Ver detalle del cambio en ${formatearCampo(item.campo)}`}
                    onClick={(evento) => {
                      evento.stopPropagation()
                      onVerDetalle(item)
                    }}
                  >
                    <EyeIcon />
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
          etiqueta="registros"
        />
      )}
    </div>
  )
}
