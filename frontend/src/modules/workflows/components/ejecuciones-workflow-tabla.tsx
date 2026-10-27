import { formatearFechaHora } from '@/lib/fechas'
import { CheckIcon, EyeIcon, MoreHorizontalIcon, RotateCcwIcon, XIcon } from 'lucide-react'
import { PaginadorServidor } from '@/components/paginador-servidor'
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
import type { EjecucionWorkflow } from '@/modules/workflows/types'
import {
  ETIQUETA_ACCION,
  ETIQUETA_ESTADO_EJECUCION,
  etiquetaEvento,
  resumenEnLinea,
  VARIANTE_ESTADO_EJECUCION,
} from '@/modules/workflows/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-40', anchoAlt: 'h-4 w-32' },
  { tipo: 'texto', ancho: 'h-4 w-36', anchoAlt: 'h-4 w-28', clase: 'hidden lg:table-cell' },
  { tipo: 'texto' },
  { tipo: 'texto', ancho: 'h-4 w-6', clase: 'hidden lg:table-cell' },
  { tipo: 'texto', ancho: 'h-4 w-28', clase: 'hidden md:table-cell' },
  { tipo: 'chip' },
  { tipo: 'accion' },
]

interface EjecucionesWorkflowTablaProps {
  items: EjecucionWorkflow[]
  cargando: boolean
  pagina: number
  tamanioPagina: number
  total: number
  totalPaginas: number
  onCambiarPagina: (pagina: number) => void
  onVerDetalle: (ejecucion: EjecucionWorkflow) => void
  /** Con permiso de actualización se ofrece "Reintentar" en las reintentables y "Aprobar" y
   * "Rechazar" en las aprobables. */
  puedeActualizar: boolean
  reintentandoId: string | null
  onReintentar: (ejecucion: EjecucionWorkflow) => void
  decidiendoId: string | null
  onAprobar: (ejecucion: EjecucionWorkflow) => void
  onRechazar: (ejecucion: EjecucionWorkflow) => void
}

export function EjecucionesWorkflowTabla({
  items,
  cargando,
  pagina,
  tamanioPagina,
  total,
  totalPaginas,
  onCambiarPagina,
  onVerDetalle,
  puedeActualizar,
  reintentandoId,
  onReintentar,
  decidiendoId,
  onAprobar,
  onRechazar,
}: EjecucionesWorkflowTablaProps) {
  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <Table bare minWidth="min-w-0">
        <TableHeader>
          <TableRow>
            <TableHead>Regla</TableHead>
            <TableHead className="hidden lg:table-cell">Evento</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead className="hidden lg:table-cell">Intento</TableHead>
            <TableHead className="hidden md:table-cell">Inicio</TableHead>
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
            items.map((ejecucion) => (
              <TableRow
                key={ejecucion.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => onVerDetalle(ejecucion)}
                onKeyDown={(evento) => {
                  if (evento.target === evento.currentTarget && evento.key === 'Enter') {
                    onVerDetalle(ejecucion)
                  }
                }}
              >
                <TableCell>
                  <span
                    className="block max-w-[14rem] truncate font-medium sm:max-w-[20rem]"
                    title={ejecucion.workflow_rule_nombre}
                  >
                    {ejecucion.workflow_rule_nombre}
                  </span>
                  {ejecucion.resumen_evento.length > 0 && (
                    <span className="block max-w-[14rem] truncate text-texto-2 sm:max-w-[20rem]">
                      {resumenEnLinea(ejecucion.resumen_evento)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden text-texto-2 lg:table-cell">
                  {etiquetaEvento(ejecucion.tipo_evento)}
                </TableCell>
                <TableCell>{ETIQUETA_ACCION[ejecucion.tipo_accion]}</TableCell>
                <TableCell className="hidden tabular-nums lg:table-cell">
                  {ejecucion.intento}
                </TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">
                  {formatearFechaHora(ejecucion.started_at)}
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_ESTADO_EJECUCION[ejecucion.estado]}>
                    {ETIQUETA_ESTADO_EJECUCION[ejecucion.estado]}
                  </Badge>
                </TableCell>
                <TableCell data-align="end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Acciones para ${ejecucion.workflow_rule_nombre}`}
                        onClick={(evento) => evento.stopPropagation()}
                        onKeyDown={(evento) => evento.stopPropagation()}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(evento) => evento.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => onVerDetalle(ejecucion)}>
                        <EyeIcon className="text-petroleo" />
                        Ver detalle
                      </DropdownMenuItem>
                      {ejecucion.reintentable && puedeActualizar && (
                        <DropdownMenuItem
                          disabled={reintentandoId === ejecucion.id}
                          onSelect={() => onReintentar(ejecucion)}
                        >
                          <RotateCcwIcon className="text-petroleo" />
                          Reintentar
                        </DropdownMenuItem>
                      )}
                      {ejecucion.aprobable && puedeActualizar && (
                        <>
                          <DropdownMenuItem
                            disabled={decidiendoId !== null}
                            onSelect={() => onAprobar(ejecucion)}
                          >
                            <CheckIcon className="text-exito" />
                            Aprobar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={decidiendoId !== null}
                            onSelect={() => onRechazar(ejecucion)}
                          >
                            <XIcon />
                            Rechazar
                          </DropdownMenuItem>
                        </>
                      )}
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
          etiqueta="ejecuciones"
        />
      )}
    </div>
  )
}
