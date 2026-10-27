import { formatearDiaDeInstante } from '@/lib/fechas'
import { CheckIcon, EyeIcon, MoreHorizontalIcon, PlayIcon } from 'lucide-react'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
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
import type { Tarea } from '@/modules/workflows/types'
import {
  estadosSiguientesTarea,
  ETIQUETA_ESTADO_TAREA,
  ETIQUETA_PRIORIDAD_TAREA,
  VARIANTE_ESTADO_TAREA,
  VARIANTE_PRIORIDAD_TAREA,
} from '@/modules/workflows/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-48', anchoAlt: 'h-4 w-36' },
  { tipo: 'texto', ancho: 'h-4 w-40', anchoAlt: 'h-4 w-32', clase: 'hidden xl:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-16', clase: 'hidden 2xl:table-cell' },
  { tipo: 'chip' },
  { tipo: 'texto', ancho: 'h-4 w-20', clase: 'hidden lg:table-cell' },
  { tipo: 'accion' },
]

export type EstadoAvance = 'en_progreso' | 'completada'

interface BotonAvanzarProps {
  estado: EstadoAvance
  disabled: boolean
  onClick: () => void
}

export function BotonAvanzar({ estado, disabled, onClick }: BotonAvanzarProps) {
  const Icono = estado === 'completada' ? CheckIcon : PlayIcon
  return (
    <Button variant="ghost" size="sm" disabled={disabled} onClick={onClick}>
      {disabled ? <Spinner data-icon="inline-start" /> : <Icono data-icon="inline-start" />}
      {estado === 'completada' ? 'Completar' : 'Iniciar'}
    </Button>
  )
}

interface TareasTablaProps {
  items: Tarea[]
  cargando: boolean
  pagina: number
  tamanioPagina: number
  total: number
  totalPaginas: number
  onCambiarPagina: (pagina: number) => void
  onVerDetalle: (tarea: Tarea) => void
  /** Si la persona puede avanzar esa tarea (es suya o puede actualizar Workflows). */
  puedeAvanzar: (tarea: Tarea) => boolean
  /** Tarea que se está cambiando de estado, para frenar un segundo clic. */
  avanzandoId: string | null
  onAvanzar: (tarea: Tarea, estado: EstadoAvance) => void
}

export function TareasTabla({
  items,
  cargando,
  pagina,
  tamanioPagina,
  total,
  totalPaginas,
  onCambiarPagina,
  onVerDetalle,
  puedeAvanzar,
  avanzandoId,
  onAvanzar,
}: TareasTablaProps) {
  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <Table bare minWidth="min-w-0">
        <TableHeader>
          <TableRow>
            <TableHead>Tarea</TableHead>
            <TableHead className="hidden xl:table-cell">Asignada a</TableHead>
            <TableHead className="hidden 2xl:table-cell">Prioridad</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden lg:table-cell">Vence</TableHead>
            <TableHead data-align="end">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando ? (
            <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={tamanioPagina} />
          ) : (
            items.map((tarea) => (
              <TableRow key={tarea.id}>
                <TableCell className="whitespace-normal md:whitespace-nowrap">
                  <span className="block font-medium md:max-w-xs md:truncate" title={tarea.titulo}>
                    {tarea.titulo}
                  </span>
                  {tarea.workflow_rule_nombre && (
                    <span className="block text-xs text-texto-3">{tarea.workflow_rule_nombre}</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-texto-2 xl:table-cell">
                  {tarea.usuario_email}
                </TableCell>
                <TableCell className="hidden 2xl:table-cell">
                  <Badge variant={VARIANTE_PRIORIDAD_TAREA[tarea.prioridad]}>
                    {ETIQUETA_PRIORIDAD_TAREA[tarea.prioridad]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_ESTADO_TAREA[tarea.estado]}>
                    {ETIQUETA_ESTADO_TAREA[tarea.estado]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden tabular-nums lg:table-cell">
                  {tarea.fecha_vencimiento ? (
                    <span className={tarea.vencida ? 'font-medium text-error' : undefined}>
                      {formatearDiaDeInstante(tarea.fecha_vencimiento)}
                      {tarea.vencida && <span className="block text-xs">Vencida</span>}
                    </span>
                  ) : (
                    <span className="text-texto-3">—</span>
                  )}
                </TableCell>
                <TableCell data-align="end" className="px-2 sm:px-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Acciones para ${tarea.titulo}`}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onVerDetalle(tarea)}>
                        <EyeIcon className="text-petroleo" />
                        Ver detalle
                      </DropdownMenuItem>
                      {puedeAvanzar(tarea) &&
                        estadosSiguientesTarea(tarea.estado).map((siguiente) => (
                          <DropdownMenuItem
                            key={siguiente}
                            disabled={avanzandoId === tarea.id}
                            onSelect={() => onAvanzar(tarea, siguiente)}
                          >
                            {siguiente === 'completada' ? (
                              <CheckIcon className="text-exito" />
                            ) : (
                              <PlayIcon className="text-petroleo" />
                            )}
                            {siguiente === 'completada' ? 'Completar' : 'Iniciar'}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
          etiqueta="tareas"
        />
      )}
    </div>
  )
}
