import { Link } from 'react-router'
import { EyeIcon, MoreHorizontalIcon, PencilIcon, PowerIcon } from 'lucide-react'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { rutaRegla } from '@/modules/workflows/constants'
import type { ReglaWorkflow, TipoEvento } from '@/modules/workflows/types'
import {
  ETIQUETA_ACCION,
  ETIQUETA_CRITICIDAD,
  etiquetaEvento,
  VARIANTE_CRITICIDAD,
} from '@/modules/workflows/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-44', anchoAlt: 'h-4 w-32' },
  { tipo: 'texto' },
  { tipo: 'texto', ancho: 'h-4 w-36', anchoAlt: 'h-4 w-28' },
  { tipo: 'texto', ancho: 'h-4 w-16', clase: 'hidden lg:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-10', clase: 'hidden lg:table-cell' },
  { tipo: 'chip' },
  { tipo: 'accion' },
]

interface ReglasWorkflowTablaProps {
  reglas: ReglaWorkflow[]
  tiposEvento: TipoEvento[]
  cargando: boolean
  /** Con permiso de actualización: "Editar" y "Activar/Desactivar". Sin él, solo "Ver". */
  puedeActualizar: boolean
  onCambiarActivo: (regla: ReglaWorkflow) => void
}

export function ReglasWorkflowTabla({
  reglas,
  tiposEvento,
  cargando,
  puedeActualizar,
  onCambiarActivo,
}: ReglasWorkflowTablaProps) {
  const nombreEvento = new Map(tiposEvento.map((tipo) => [tipo.id, etiquetaEvento(tipo.nombre)]))

  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <Table bare minWidth="min-w-0">
        <TableHeader>
          <TableRow>
            <TableHead>Regla</TableHead>
            <TableHead>Disparador</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead className="hidden lg:table-cell">Criticidad</TableHead>
            <TableHead className="hidden lg:table-cell">Aprob. humana</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead data-align="end">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando ? (
            <TableSkeleton columnas={COLUMNAS_ESQUELETO} />
          ) : (
            reglas.map((regla) => (
              <TableRow key={regla.id}>
                <TableCell
                  className="max-w-[12rem] truncate font-medium sm:max-w-xs"
                  title={regla.nombre}
                >
                  {regla.nombre}
                </TableCell>
                <TableCell className="text-texto-2">
                  {nombreEvento.get(regla.tipo_evento_id) ?? 'Evento desconocido'}
                </TableCell>
                <TableCell>{ETIQUETA_ACCION[regla.tipo_accion]}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge variant={VARIANTE_CRITICIDAD[regla.criticidad]}>
                    {ETIQUETA_CRITICIDAD[regla.criticidad]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {regla.requiere_aprobacion_humana ? 'Sí' : 'No'}
                </TableCell>
                <TableCell>
                  <Badge variant={regla.activo ? 'exito' : 'neutro'}>
                    {regla.activo ? 'Activa' : 'Inactiva'}
                  </Badge>
                </TableCell>
                <TableCell data-align="end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Acciones para ${regla.nombre}`}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={rutaRegla(regla.id)}>
                          {puedeActualizar ? (
                            <PencilIcon className="text-petroleo" />
                          ) : (
                            <EyeIcon className="text-petroleo" />
                          )}
                          {puedeActualizar ? 'Editar' : 'Ver'}
                        </Link>
                      </DropdownMenuItem>
                      {puedeActualizar && (
                        <DropdownMenuItem onSelect={() => onCambiarActivo(regla)}>
                          <PowerIcon />
                          {regla.activo ? 'Desactivar' : 'Activar'}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
