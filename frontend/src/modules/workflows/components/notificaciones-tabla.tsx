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
  formatearFechaHora,
  VARIANTE_ESTADO_ENVIO,
} from '@/modules/workflows/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-44', anchoAlt: 'h-4 w-36' },
  { tipo: 'chip' },
  { tipo: 'texto', ancho: 'h-4 w-48', anchoAlt: 'h-4 w-40' },
  { tipo: 'texto', ancho: 'h-4 w-32', anchoAlt: 'h-4 w-28' },
  { tipo: 'texto', ancho: 'h-4 w-28' },
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
      <Table bare minWidth="min-w-[1040px]">
        <TableHeader>
          <TableRow>
            <TableHead>Destinatario</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Asunto</TableHead>
            <TableHead>Regla</TableHead>
            <TableHead>Enviada el</TableHead>
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
                <TableCell className="font-medium">{notificacion.destinatario_snapshot}</TableCell>
                <TableCell>{ETIQUETA_DESTINATARIO_TIPO[notificacion.destinatario_tipo]}</TableCell>
                <TableCell className="max-w-xs truncate text-texto-2">
                  {notificacion.asunto_snapshot}
                </TableCell>
                <TableCell className="text-texto-2">{notificacion.workflow_rule_nombre}</TableCell>
                <TableCell className="tabular-nums">
                  {notificacion.sent_at ? formatearFechaHora(notificacion.sent_at) : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_ESTADO_ENVIO[notificacion.estado_envio]}>
                    {ETIQUETA_ESTADO_ENVIO[notificacion.estado_envio]}
                  </Badge>
                </TableCell>
                <TableCell data-align="end">
                  <Button variant="ghost" size="sm" onClick={() => onVerDetalle(notificacion)}>
                    <EyeIcon data-icon="inline-start" />
                    Ver detalle
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
