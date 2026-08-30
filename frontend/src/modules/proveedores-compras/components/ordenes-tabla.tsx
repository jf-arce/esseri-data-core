import { BanIcon, MoreHorizontalIcon, PackageCheckIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Pagination,
  PaginationContent,
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
import type { EstadoOrdenCompra, OrdenListadoItem } from '@/modules/proveedores-compras/types'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-40', anchoAlt: 'h-4 w-32' },
  { tipo: 'texto', ancho: 'h-4 w-24', anchoAlt: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-12', anchoAlt: 'h-4 w-10' },
  { tipo: 'texto', ancho: 'h-4 w-16', anchoAlt: 'h-4 w-14' },
  { tipo: 'chip', ancho: 'w-24', anchoAlt: 'w-20' },
  { tipo: 'accion' },
]

// `cancelada` va en neutro y no en error: es un cierre administrativo previsto, no una falla.
const VARIANTE_POR_ESTADO: Record<EstadoOrdenCompra, 'exito' | 'info' | 'neutro'> = {
  emitida: 'info',
  recibida: 'exito',
  cancelada: 'neutro',
}

const ETIQUETA_POR_ESTADO: Record<EstadoOrdenCompra, string> = {
  emitida: 'Emitida',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
}

interface OrdenesTablaProps {
  ordenes: OrdenListadoItem[]
  cargando: boolean
  densidad: 'comfortable' | 'compact'
  pagina: number
  totalPaginas: number
  total: number
  onCambiarPagina: (pagina: number) => void
  onRecibir: (orden: OrdenListadoItem) => void
  onCancelar: (orden: OrdenListadoItem) => void
}

function OrdenesTabla({
  ordenes,
  cargando,
  densidad,
  pagina,
  totalPaginas,
  total,
  onCambiarPagina,
  onRecibir,
  onCancelar,
}: OrdenesTablaProps) {
  return (
    <div className="flex flex-col gap-3">
      <Table data-density={densidad === 'compact' ? 'compact' : undefined}>
        <TableHeader>
          <TableRow>
            <TableHead>Proveedor</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead data-align="end">Ítems</TableHead>
            <TableHead data-align="end">Unidades</TableHead>
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
            ordenes.map((orden) => (
              <TableRow key={orden.id}>
                <TableCell className="font-medium">{orden.proveedor_nombre}</TableCell>
                <TableCell className="text-texto-2 tabular-nums">{orden.fecha}</TableCell>
                <TableCell data-align="end" className="tabular-nums">
                  {orden.cantidad_items}
                </TableCell>
                <TableCell data-align="end" className="tabular-nums">
                  {orden.unidades_pedidas}
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_POR_ESTADO[orden.estado]}>
                    {ETIQUETA_POR_ESTADO[orden.estado]}
                  </Badge>
                </TableCell>
                <TableCell data-align="end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Acciones para la orden de ${orden.proveedor_nombre}`}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* Las acciones dependen del estado (§9.2 DESIGN.md): solo una orden
                          emitida se puede recibir o cancelar. Una recibida ya cerró su ciclo y
                          una cancelada nunca va a llegar. */}
                      {orden.estado === 'emitida' ? (
                        <>
                          <DropdownMenuItem onSelect={() => onRecibir(orden)}>
                            <PackageCheckIcon className="text-petroleo" />
                            Registrar recepción
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onCancelar(orden)}
                          >
                            <BanIcon />
                            Cancelar orden
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem disabled>Sin acciones disponibles</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-texto-2 text-sm tabular-nums">
            {total} {total === 1 ? 'orden' : 'órdenes'} · página {pagina} de {totalPaginas}
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  aria-disabled={pagina <= 1}
                  className={pagina <= 1 ? 'pointer-events-none opacity-50' : undefined}
                  onClick={(evento) => {
                    evento.preventDefault()
                    if (pagina > 1) onCambiarPagina(pagina - 1)
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive onClick={(evento) => evento.preventDefault()}>
                  {pagina}
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  aria-disabled={pagina >= totalPaginas}
                  className={pagina >= totalPaginas ? 'pointer-events-none opacity-50' : undefined}
                  onClick={(evento) => {
                    evento.preventDefault()
                    if (pagina < totalPaginas) onCambiarPagina(pagina + 1)
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}

export { OrdenesTabla }
