import type { MouseEvent } from 'react'
import { EyeIcon } from 'lucide-react'
import { paginasVisibles } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationCount,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
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
}: EjecucionesWorkflowTablaProps) {
  const primeraFila = (pagina - 1) * tamanioPagina + 1
  const ultimaFila = Math.min(total, pagina * tamanioPagina)

  const irA = (destino: number) => (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.preventDefault()
    if (destino >= 1 && destino <= totalPaginas) onCambiarPagina(destino)
  }

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
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {!cargando && total > 0 && (
        <Pagination>
          <PaginationCount>
            {primeraFila}-{ultimaFila} de {total} ejecuciones
          </PaginationCount>
          {totalPaginas > 1 && (
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  text=""
                  onClick={irA(pagina - 1)}
                  aria-disabled={pagina === 1}
                  tabIndex={pagina === 1 ? -1 : 0}
                  className={cn(pagina === 1 && 'pointer-events-none opacity-40')}
                />
              </PaginationItem>
              {paginasVisibles(totalPaginas, pagina).map((item, indice) =>
                item === 'elipsis' ? (
                  <PaginationItem key={`elipsis-${indice}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink isActive={item === pagina} onClick={irA(item)}>
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  text=""
                  onClick={irA(pagina + 1)}
                  aria-disabled={pagina === totalPaginas}
                  tabIndex={pagina === totalPaginas ? -1 : 0}
                  className={cn(pagina === totalPaginas && 'pointer-events-none opacity-40')}
                />
              </PaginationItem>
            </PaginationContent>
          )}
        </Pagination>
      )}
    </div>
  )
}
