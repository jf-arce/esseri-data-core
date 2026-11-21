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
import type { NotificacionEnviada } from '@/modules/workflows/types'
import {
  ETIQUETA_DESTINATARIO_TIPO,
  ETIQUETA_ESTADO_ENVIO,
  VARIANTE_ESTADO_ENVIO,
} from '@/modules/workflows/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-44', anchoAlt: 'h-4 w-36' },
  { tipo: 'texto', ancho: 'h-4 w-16', clase: 'hidden @6xl/main:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-48', anchoAlt: 'h-4 w-40', clase: 'hidden @5xl/main:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-32', anchoAlt: 'h-4 w-28', clase: 'hidden @6xl/main:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-28', clase: 'hidden @7xl/main:table-cell' },
  { tipo: 'chip' },
  { tipo: 'accion' },
]

interface NotificacionesTablaProps {
  items: NotificacionEnviada[]
  cargando: boolean
  pagina: number
  tamanioPagina: number
  total: number
  totalPaginas: number
  onCambiarPagina: (pagina: number) => void
  onVerDetalle: (notificacion: NotificacionEnviada) => void
}

export function NotificacionesTabla({
  items,
  cargando,
  pagina,
  tamanioPagina,
  total,
  totalPaginas,
  onCambiarPagina,
  onVerDetalle,
}: NotificacionesTablaProps) {
  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <Table bare minWidth="min-w-0">
        <TableHeader>
          <TableRow>
            <TableHead>Destinatario</TableHead>
            <TableHead className="hidden @6xl/main:table-cell">Tipo</TableHead>
            <TableHead className="hidden @5xl/main:table-cell">Asunto</TableHead>
            <TableHead className="hidden @6xl/main:table-cell">Regla</TableHead>
            <TableHead className="hidden @7xl/main:table-cell">Enviada el</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead data-align="end">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando ? (
            <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={tamanioPagina} />
          ) : (
            items.map((notificacion) => (
              <TableRow key={notificacion.id}>
                <TableCell className="font-medium whitespace-normal @3xl/main:whitespace-nowrap">
                  <span
                    className="block break-words @3xl/main:max-w-[16rem] @3xl/main:truncate"
                    title={notificacion.destinatario_snapshot}
                  >
                    {notificacion.destinatario_snapshot}
                  </span>
                </TableCell>
                <TableCell className="hidden @6xl/main:table-cell">
                  {ETIQUETA_DESTINATARIO_TIPO[notificacion.destinatario_tipo]}
                </TableCell>
                <TableCell className="hidden text-texto-2 @5xl/main:table-cell">
                  <span
                    className="block max-w-[14rem] truncate"
                    title={notificacion.asunto_snapshot}
                  >
                    {notificacion.asunto_snapshot}
                  </span>
                </TableCell>
                <TableCell className="hidden text-texto-2 @6xl/main:table-cell">
                  <span
                    className="block max-w-[14rem] truncate"
                    title={notificacion.workflow_rule_nombre}
                  >
                    {notificacion.workflow_rule_nombre}
                  </span>
                </TableCell>
                <TableCell className="hidden tabular-nums @7xl/main:table-cell">
                  {notificacion.sent_at ? formatearFechaHora(notificacion.sent_at) : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_ESTADO_ENVIO[notificacion.estado_envio]}>
                    {ETIQUETA_ESTADO_ENVIO[notificacion.estado_envio]}
                  </Badge>
                </TableCell>
                <TableCell data-align="end" className="px-2 @xl/main:px-4">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Ver detalle de ${notificacion.asunto_snapshot}`}
                    onClick={() => onVerDetalle(notificacion)}
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
          etiqueta="notificaciones"
        />
      )}
    </div>
  )
}
