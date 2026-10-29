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
  { tipo: 'texto', ancho: 'h-4 w-16', clase: 'hidden 2xl:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-48', anchoAlt: 'h-4 w-40', clase: 'hidden lg:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-32', anchoAlt: 'h-4 w-28', clase: 'hidden 2xl:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-28', clase: 'hidden xl:table-cell' },
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
            <TableHead className="hidden 2xl:table-cell">Tipo</TableHead>
            <TableHead className="hidden lg:table-cell">Asunto</TableHead>
            <TableHead className="hidden 2xl:table-cell">Regla</TableHead>
            <TableHead className="hidden xl:table-cell">Enviada el</TableHead>
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
                <TableCell
                  className="whitespace-normal break-all font-medium md:max-w-[16rem] md:truncate md:whitespace-nowrap md:break-normal"
                  title={notificacion.destinatario_snapshot}
                >
                  {notificacion.destinatario_snapshot}
                </TableCell>
                <TableCell className="hidden 2xl:table-cell">
                  {ETIQUETA_DESTINATARIO_TIPO[notificacion.destinatario_tipo]}
                </TableCell>
                <TableCell
                  className="hidden max-w-[14rem] truncate text-texto-2 lg:table-cell"
                  title={notificacion.asunto_snapshot}
                >
                  {notificacion.asunto_snapshot}
                </TableCell>
                <TableCell
                  className="hidden max-w-[14rem] truncate text-texto-2 2xl:table-cell"
                  title={notificacion.workflow_rule_nombre}
                >
                  {notificacion.workflow_rule_nombre}
                </TableCell>
                <TableCell className="hidden tabular-nums xl:table-cell">
                  {notificacion.sent_at ? formatearFechaHora(notificacion.sent_at) : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_ESTADO_ENVIO[notificacion.estado_envio]}>
                    {ETIQUETA_ESTADO_ENVIO[notificacion.estado_envio]}
                  </Badge>
                </TableCell>
                <TableCell data-align="end" className="px-2 sm:px-4">
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
