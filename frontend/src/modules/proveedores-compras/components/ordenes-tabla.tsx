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
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { EstadoOrdenCompra, OrdenCompra } from '@/modules/proveedores-compras/types'
import { totalUnidadesPedidas } from '@/modules/proveedores-compras/utils'

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
  ordenes: OrdenCompra[]
  cargando: boolean
  densidad: 'comfortable' | 'compact'
  nombrePorProveedor: Record<string, string>
  onRecibir: (orden: OrdenCompra) => void
  onCancelar: (orden: OrdenCompra) => void
}

function OrdenesTabla({
  ordenes,
  cargando,
  densidad,
  nombrePorProveedor,
  onRecibir,
  onCancelar,
}: OrdenesTablaProps) {
  return (
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
              <TableCell className="font-medium">
                {nombrePorProveedor[orden.proveedor_id] ?? 'Proveedor eliminado'}
              </TableCell>
              <TableCell className="text-texto-2 tabular-nums">{orden.fecha}</TableCell>
              <TableCell data-align="end" className="tabular-nums">
                {orden.detalles.length}
              </TableCell>
              <TableCell data-align="end" className="tabular-nums">
                {totalUnidadesPedidas(orden)}
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
                      aria-label={`Acciones para la orden del ${orden.fecha}`}
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
                        <DropdownMenuItem variant="destructive" onSelect={() => onCancelar(orden)}>
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
  )
}

export { OrdenesTabla }
