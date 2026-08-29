import { CheckIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon, XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { EstadoSolicitud, SolicitudCompra } from '@/modules/proveedores-compras/types'
import { descripcionSolicitud } from '@/modules/proveedores-compras/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-44', anchoAlt: 'h-4 w-32' },
  { tipo: 'texto', ancho: 'h-4 w-10', anchoAlt: 'h-4 w-12' },
  { tipo: 'texto', ancho: 'h-4 w-28', anchoAlt: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-24', anchoAlt: 'h-4 w-24' },
  { tipo: 'chip', ancho: 'w-24', anchoAlt: 'w-20' },
  { tipo: 'accion' },
]

// El estado nunca se comunica solo por color (§2.4 DESIGN.md): el badge lleva siempre el texto.
// "rechazada" usa `error` porque es un cierre negativo del pedido; "pendiente" usa `neutro`
// porque es ausencia de decisión, no una alerta.
const VARIANTE_POR_ESTADO: Record<EstadoSolicitud, 'exito' | 'error' | 'neutro'> = {
  aprobada: 'exito',
  rechazada: 'error',
  pendiente: 'neutro',
}

const ETIQUETA_POR_ESTADO: Record<EstadoSolicitud, string> = {
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  pendiente: 'Pendiente',
}

function BadgeEstado({ estado }: { estado: EstadoSolicitud }) {
  return <Badge variant={VARIANTE_POR_ESTADO[estado]}>{ETIQUETA_POR_ESTADO[estado]}</Badge>
}

interface SolicitudesTablaProps {
  solicitudes: SolicitudCompra[]
  cargando: boolean
  densidad: 'comfortable' | 'compact'
  onEditar: (solicitud: SolicitudCompra) => void
  onCambiarEstado: (solicitud: SolicitudCompra, estado: EstadoSolicitud) => void
  onEliminar: (solicitud: SolicitudCompra) => void
}

function SolicitudesTabla({
  solicitudes,
  cargando,
  densidad,
  onEditar,
  onCambiarEstado,
  onEliminar,
}: SolicitudesTablaProps) {
  return (
    <Table data-density={densidad === 'compact' ? 'compact' : undefined}>
      <TableHeader>
        <TableRow>
          <TableHead>Artículo</TableHead>
          <TableHead data-align="end">Cantidad</TableHead>
          <TableHead>Área</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead data-align="end">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cargando ? (
          <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={8} />
        ) : (
          solicitudes.map((solicitud) => (
            <TableRow key={solicitud.id}>
              <TableCell className="font-medium">{descripcionSolicitud(solicitud)}</TableCell>
              <TableCell data-align="end" className="tabular-nums">
                {solicitud.cantidad}
              </TableCell>
              <TableCell className="text-texto-2">{solicitud.area_solicitante ?? '—'}</TableCell>
              <TableCell className="text-texto-2 tabular-nums">{solicitud.fecha}</TableCell>
              <TableCell>
                <BadgeEstado estado={solicitud.estado} />
              </TableCell>
              <TableCell data-align="end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Acciones para la solicitud de ${descripcionSolicitud(solicitud)}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* Aprobar y rechazar solo aparecen mientras la decisión no está tomada
                        (§9.2 DESIGN.md: acción condicional al estado de la fila). */}
                    {solicitud.estado === 'pendiente' && (
                      <>
                        <DropdownMenuItem onSelect={() => onCambiarEstado(solicitud, 'aprobada')}>
                          <CheckIcon className="text-exito" />
                          Aprobar solicitud
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onCambiarEstado(solicitud, 'rechazada')}>
                          <XIcon className="text-advertencia" />
                          Rechazar solicitud
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onSelect={() => onEditar(solicitud)}>
                      <PencilIcon className="text-petroleo" />
                      Editar solicitud
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => onEliminar(solicitud)}>
                      <Trash2Icon />
                      Eliminar solicitud
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

export { SolicitudesTabla }
