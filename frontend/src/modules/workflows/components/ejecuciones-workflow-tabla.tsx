import { EyeIcon, RotateCcwIcon } from 'lucide-react'
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
import type { EjecucionWorkflow } from '@/modules/workflows/types'
import {
  ETIQUETA_ACCION,
  ETIQUETA_ESTADO_EJECUCION,
  etiquetaEvento,
  formatearFechaHora,
  VARIANTE_ESTADO_EJECUCION,
} from '@/modules/workflows/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-40', anchoAlt: 'h-4 w-32' },
  { tipo: 'texto', ancho: 'h-4 w-36', anchoAlt: 'h-4 w-28' },
  { tipo: 'texto' },
  { tipo: 'texto', ancho: 'h-4 w-6' },
  { tipo: 'texto', ancho: 'h-4 w-28' },
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
  /** Con permiso de actualización se ofrece "Reintentar" en las ejecuciones reintentables. */
  puedeActualizar: boolean
  reintentandoId: string | null
  onReintentar: (ejecucion: EjecucionWorkflow) => void
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
}: EjecucionesWorkflowTablaProps) {
  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <Table bare minWidth="min-w-[960px]">
        <TableHeader>
          <TableRow>
            <TableHead>Regla</TableHead>
            <TableHead>Evento</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead>Intento</TableHead>
            <TableHead>Inicio</TableHead>
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
              <TableRow key={ejecucion.id}>
                <TableCell className="font-medium">{ejecucion.workflow_rule_nombre}</TableCell>
                <TableCell className="text-texto-2">
                  {etiquetaEvento(ejecucion.tipo_evento)}
                </TableCell>
                <TableCell>{ETIQUETA_ACCION[ejecucion.tipo_accion]}</TableCell>
                <TableCell className="tabular-nums">{ejecucion.intento}</TableCell>
                <TableCell className="tabular-nums">
                  {formatearFechaHora(ejecucion.started_at)}
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_ESTADO_EJECUCION[ejecucion.estado]}>
                    {ETIQUETA_ESTADO_EJECUCION[ejecucion.estado]}
                  </Badge>
                </TableCell>
                <TableCell data-align="end">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onVerDetalle(ejecucion)}>
                      <EyeIcon data-icon="inline-start" />
                      Ver detalle
                    </Button>
                    {ejecucion.reintentable && puedeActualizar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={reintentandoId === ejecucion.id}
                        onClick={() => onReintentar(ejecucion)}
                      >
                        {reintentandoId === ejecucion.id ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <RotateCcwIcon data-icon="inline-start" />
                        )}
                        Reintentar
                      </Button>
                    )}
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
          etiqueta="ejecuciones"
        />
      )}
    </div>
  )
}
