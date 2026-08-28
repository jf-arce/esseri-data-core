import type { MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
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
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { InscripcionListadoItem, TipoInscripcion } from '@/modules/inscripciones/types'
import {
  etiquetaEstadoInscripcion,
  etiquetaTipoInscripcion,
  formatearFechaInscripcion,
  paginasVisibles,
} from '@/modules/inscripciones/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-36', anchoAlt: 'h-4 w-28' },
  { tipo: 'texto', ancho: 'h-4 w-20', anchoAlt: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-12' },
  { tipo: 'chip', ancho: 'w-24', anchoAlt: 'w-28' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
  { tipo: 'chip', ancho: 'w-20', anchoAlt: 'w-16' },
]

const CLASE_TIPO: Record<TipoInscripcion, string> = {
  nueva: 'bg-[color-mix(in_oklch,var(--petroleo)_12%,white)] text-petroleo',
  reinscripcion: 'bg-info-suave text-info',
  cambio_matricula: 'bg-[color-mix(in_oklch,var(--mod-compras)_12%,white)] text-mod-compras',
  baja: 'bg-advertencia-suave text-advertencia',
}

function TipoChip({ tipo }: { tipo: TipoInscripcion }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap',
        CLASE_TIPO[tipo],
      )}
    >
      {etiquetaTipoInscripcion(tipo)}
    </span>
  )
}

interface InscripcionesTablaProps {
  items: InscripcionListadoItem[]
  cargando: boolean
  densidad: 'comfortable' | 'compact'
  pagina: number
  tamanioPagina: number
  total: number
  totalPaginas: number
  onCambiarPagina: (pagina: number) => void
}

export function InscripcionesTabla({
  items,
  cargando,
  densidad,
  pagina,
  tamanioPagina,
  total,
  totalPaginas,
  onCambiarPagina,
}: InscripcionesTablaProps) {
  const primeraFila = (pagina - 1) * tamanioPagina + 1
  const ultimaFila = Math.min(total, pagina * tamanioPagina)

  const irA = (destino: number) => (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.preventDefault()
    if (destino >= 1 && destino <= totalPaginas) onCambiarPagina(destino)
  }

  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <Table
        bare
        data-density={densidad === 'compact' ? 'compact' : undefined}
        minWidth="min-w-[860px]"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Alumno</TableHead>
            <TableHead>División</TableHead>
            <TableHead>Ciclo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando ? (
            <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={tamanioPagina} />
          ) : (
            items.map((inscripcion) => (
              <TableRow key={inscripcion.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {inscripcion.alumno_apellido}, {inscripcion.alumno_nombre}
                    </span>
                    <span className="text-xs text-texto-3">{inscripcion.numero_legajo}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{inscripcion.division_nombre}</span>
                    <span className="text-xs text-texto-3">
                      {inscripcion.nivel_educativo_nombre}, {inscripcion.anio_numero}° año
                    </span>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{inscripcion.ciclo_lectivo}</TableCell>
                <TableCell>
                  <TipoChip tipo={inscripcion.tipo} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatearFechaInscripcion(inscripcion.fecha_inscripcion)}
                </TableCell>
                <TableCell>
                  <Badge variant={inscripcion.estado === 'activa' ? 'exito' : 'neutro'}>
                    {etiquetaEstadoInscripcion(inscripcion.estado)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {!cargando && total > 0 && (
        <Pagination>
          <PaginationCount>
            {primeraFila}-{ultimaFila} de {total} inscripciones
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
