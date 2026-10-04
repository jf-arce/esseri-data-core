import { ArrowRightLeftIcon, MoreHorizontalIcon, UserRoundMinusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PaginadorServidor } from '@/components/paginador-servidor'
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
} from '@/modules/inscripciones/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-36', anchoAlt: 'h-4 w-28' },
  { tipo: 'texto', ancho: 'h-4 w-20', anchoAlt: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-12' },
  { tipo: 'chip', ancho: 'w-24', anchoAlt: 'w-28' },
  { tipo: 'texto', ancho: 'h-4 w-20' },
  { tipo: 'chip', ancho: 'w-20', anchoAlt: 'w-16' },
  { tipo: 'texto', ancho: 'h-4 w-8' },
]

const CLASE_TIPO: Record<TipoInscripcion, string> = {
  nueva: 'bg-petroleo-suave text-petroleo',
  reinscripcion: 'bg-info-suave text-info',
  cambio_matricula: 'bg-mod-compras-suave text-mod-compras',
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
  pagina: number
  tamanioPagina: number
  total: number
  totalPaginas: number
  onCambiarPagina: (pagina: number) => void
  onCambiarMatricula: (inscripcion: InscripcionListadoItem) => void
  onRegistrarBaja: (inscripcion: InscripcionListadoItem) => void
}

export function InscripcionesTabla({
  items,
  cargando,
  pagina,
  tamanioPagina,
  total,
  totalPaginas,
  onCambiarPagina,
  onCambiarMatricula,
  onRegistrarBaja,
}: InscripcionesTablaProps) {
  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <Table bare minWidth="min-w-[940px]">
        <TableHeader>
          <TableRow>
            <TableHead>Alumno</TableHead>
            <TableHead>División</TableHead>
            <TableHead>Ciclo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha</TableHead>
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
                <TableCell data-align="end">
                  {inscripcion.estado === 'activa' ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones para ${inscripcion.alumno_apellido}, ${inscripcion.alumno_nombre}`}
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onSelect={() => onCambiarMatricula(inscripcion)}>
                            <ArrowRightLeftIcon className="text-petroleo" />
                            Cambio de matrícula
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onRegistrarBaja(inscripcion)}
                          >
                            <UserRoundMinusIcon />
                            Registrar baja
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="text-texto-3" aria-label="Sin acciones disponibles">
                      —
                    </span>
                  )}
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
          etiqueta="inscripciones"
        />
      )}
    </div>
  )
}
