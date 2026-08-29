import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react'
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
import type { ProductoServicio } from '@/modules/proveedores-compras/types'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-44', anchoAlt: 'h-4 w-32' },
  { tipo: 'chip', ancho: 'w-20', anchoAlt: 'w-24' },
  { tipo: 'chip', ancho: 'w-24', anchoAlt: 'w-20' },
  { tipo: 'texto', ancho: 'h-4 w-16', anchoAlt: 'h-4 w-12' },
  { tipo: 'chip', ancho: 'w-20', anchoAlt: 'w-20' },
  { tipo: 'accion' },
]

interface ProductosTablaProps {
  productos: ProductoServicio[]
  cargando: boolean
  densidad: 'comfortable' | 'compact'
  onEditar: (producto: ProductoServicio) => void
  onEliminar: (producto: ProductoServicio) => void
}

function ProductosTabla({
  productos,
  cargando,
  densidad,
  onEditar,
  onEliminar,
}: ProductosTablaProps) {
  return (
    <Table data-density={densidad === 'compact' ? 'compact' : undefined}>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Unidad</TableHead>
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
          productos.map((producto) => (
            <TableRow key={producto.id}>
              <TableCell className="font-medium">{producto.nombre}</TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {producto.tipo === 'producto' ? 'Producto' : 'Servicio'}
                </Badge>
              </TableCell>
              <TableCell>
                {producto.categoria ? (
                  <Badge variant="modulo" data-modulo="compras">
                    {producto.categoria}
                  </Badge>
                ) : (
                  <span className="text-texto-2">—</span>
                )}
              </TableCell>
              <TableCell className="text-texto-2">{producto.unidad ?? '—'}</TableCell>
              <TableCell>
                <Badge variant={producto.activo ? 'exito' : 'neutro'}>
                  {producto.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              <TableCell data-align="end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Acciones para ${producto.nombre}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEditar(producto)}>
                      <PencilIcon className="text-petroleo" />
                      Editar ítem
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => onEliminar(producto)}>
                      <Trash2Icon />
                      Eliminar ítem
                    </DropdownMenuItem>
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

export { ProductosTabla }
