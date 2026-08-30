import { MoreHorizontalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SolicitudAdmisionListadoItem } from '@/modules/inscripciones/types'
import {
  etiquetaEstadoSolicitud,
  etiquetaEtapaSolicitud,
  formatearFechaInscripcion,
} from '@/modules/inscripciones/utils'

function varianteEstado(estado: SolicitudAdmisionListadoItem['estado']) {
  if (estado === 'aprobada') return 'exito' as const
  if (estado === 'rechazada') return 'error' as const
  if (estado === 'desistida') return 'neutro' as const
  return 'advertencia' as const
}

interface SolicitudesAdmisionTablaProps {
  items: SolicitudAdmisionListadoItem[]
  onVerDetalle: (solicitudId: string) => void
}

export function SolicitudesAdmisionTabla({ items, onVerDetalle }: SolicitudesAdmisionTablaProps) {
  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <Table bare minWidth="min-w-[790px]">
        <TableHeader>
          <TableRow>
            <TableHead>Aspirante</TableHead>
            <TableHead>Nivel</TableHead>
            <TableHead>Etapa actual</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead data-align="end">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((solicitud) => (
            <TableRow key={solicitud.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {solicitud.aspirante_apellido}, {solicitud.aspirante_nombre}
                  </span>
                  <span className="text-xs text-texto-3">DNI {solicitud.aspirante_dni}</span>
                </div>
              </TableCell>
              <TableCell>{solicitud.nivel_educativo_nombre}</TableCell>
              <TableCell>{etiquetaEtapaSolicitud(solicitud.etapa)}</TableCell>
              <TableCell className="tabular-nums">
                {formatearFechaInscripcion(solicitud.fecha_solicitud)}
              </TableCell>
              <TableCell>
                <Badge variant={varianteEstado(solicitud.estado)}>
                  {etiquetaEstadoSolicitud(solicitud.estado)}
                </Badge>
              </TableCell>
              <TableCell data-align="end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Acciones para ${solicitud.aspirante_apellido}, ${solicitud.aspirante_nombre}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onVerDetalle(solicitud.id)}>
                      Ver solicitud
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
