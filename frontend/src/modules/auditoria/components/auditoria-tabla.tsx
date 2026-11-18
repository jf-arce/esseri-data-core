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
  { tipo: 'texto', ancho: 'h-4 w-24', clase: 'hidden lg:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-24', clase: 'hidden xl:table-cell' },
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
      <Table bare minWidth="min-w-0">
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Entidad</TableHead>
            <TableHead>Campo</TableHead>
            <TableHead>Cambio</TableHead>
            <TableHead className="hidden lg:table-cell">Actor</TableHead>
            <TableHead className="hidden xl:table-cell">Origen</TableHead>
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
                <TableCell className="whitespace-nowrap font-medium">
                  {etiquetaEntidad(item.entidad)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-texto-2">
                  {formatearCampo(item.campo)}
                </TableCell>
                <TableCell className="max-w-[20rem] whitespace-normal">
                  <ValoresCambio
                    valorAnterior={item.valor_anterior}
                    valorNuevo={item.valor_nuevo}
                  />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex flex-col gap-1">
                    <Badge variant={item.actor_tipo === 'sistema' ? 'neutro' : 'info'}>
                      {item.actor_tipo === 'sistema' ? 'Sistema' : 'Usuario'}
                    </Badge>
                    {item.usuario_email && (
                      <span
                        className="max-w-[14rem] truncate text-xs text-texto-3"
                        title={item.usuario_email}
                      >
                        {item.usuario_email}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden text-texto-2 xl:table-cell">
                  {item.origen ? formatearCampo(item.origen) : '—'}
                </TableCell>
                <TableCell data-align="end" className="px-2 sm:px-4">
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
