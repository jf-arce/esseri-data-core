import { CheckIcon, EyeIcon, PlayIcon } from 'lucide-react'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
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
  formatearFecha,
  VARIANTE_ESTADO_TAREA,
  VARIANTE_PRIORIDAD_TAREA,
} from '@/modules/workflows/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-48', anchoAlt: 'h-4 w-36' },
  { tipo: 'texto', ancho: 'h-4 w-40', anchoAlt: 'h-4 w-32' },
  { tipo: 'chip' },
  { tipo: 'chip' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
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
      <Table bare minWidth="min-w-[960px]">
        <TableHeader>
          <TableRow>
            <TableHead>Tarea</TableHead>
            <TableHead>Asignada a</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Vence</TableHead>
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
                <TableCell>
                  <span className="font-medium">{tarea.titulo}</span>
                  {tarea.workflow_rule_nombre && (
                    <span className="block text-xs text-texto-3">{tarea.workflow_rule_nombre}</span>
                  )}
                </TableCell>
                <TableCell className="text-texto-2">{tarea.usuario_email}</TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_PRIORIDAD_TAREA[tarea.prioridad]}>
                    {ETIQUETA_PRIORIDAD_TAREA[tarea.prioridad]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_ESTADO_TAREA[tarea.estado]}>
                    {ETIQUETA_ESTADO_TAREA[tarea.estado]}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {tarea.fecha_vencimiento ? (
                    <span className={tarea.vencida ? 'font-medium text-error' : undefined}>
                      {formatearFecha(tarea.fecha_vencimiento)}
                      {tarea.vencida && <span className="block text-xs">Vencida</span>}
                    </span>
                  ) : (
                    <span className="text-texto-3">—</span>
                  )}
                </TableCell>
                <TableCell data-align="end">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onVerDetalle(tarea)}>
                      <EyeIcon data-icon="inline-start" />
                      Ver detalle
                    </Button>
                    {puedeAvanzar(tarea) &&
                      estadosSiguientesTarea(tarea.estado).map((siguiente) => (
                        <BotonAvanzar
                          key={siguiente}
                          estado={siguiente}
                          disabled={avanzandoId === tarea.id}
                          onClick={() => onAvanzar(tarea, siguiente)}
                        />
                      ))}
                  </div>
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
