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
import type { Proveedor } from '@/modules/proveedores-compras/types'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-40', anchoAlt: 'h-4 w-32' },
  { tipo: 'chip', ancho: 'w-24', anchoAlt: 'w-20' },
  { tipo: 'texto', ancho: 'h-4 w-28', anchoAlt: 'h-4 w-36' },
  { tipo: 'chip', ancho: 'w-20', anchoAlt: 'w-20' },
  { tipo: 'accion' },
]

// El estado no se comunica solo por color (§2.4 DESIGN.md): el badge lleva el texto siempre.
function BadgeEstado({ estado }: { estado: Proveedor['estado'] }) {
  return (
    <Badge variant={estado === 'activo' ? 'exito' : 'neutro'}>
      {estado === 'activo' ? 'Activo' : 'Inactivo'}
    </Badge>
  )
}

interface ProveedoresTablaProps {
  proveedores: Proveedor[]
  cargando: boolean
  densidad: 'comfortable' | 'compact'
  onEditar: (proveedor: Proveedor) => void
  onEliminar: (proveedor: Proveedor) => void
}

function ProveedoresTabla({
  proveedores,
  cargando,
  densidad,
  onEditar,
  onEliminar,
}: ProveedoresTablaProps) {
  return (
    <Table data-density={densidad === 'compact' ? 'compact' : undefined}>
      <TableHeader>
        <TableRow>
          <TableHead>Proveedor</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Contacto</TableHead>
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
          proveedores.map((proveedor) => (
            <TableRow key={proveedor.id}>
              <TableCell className="font-medium">{proveedor.nombre}</TableCell>
              <TableCell>
                {proveedor.categoria ? (
                  <Badge variant="modulo" data-modulo="compras">
                    {proveedor.categoria}
                  </Badge>
                ) : (
                  <span className="text-texto-2">—</span>
                )}
              </TableCell>
              <TableCell className="text-texto-2">
                {proveedor.email ?? proveedor.telefono ?? '—'}
              </TableCell>
              <TableCell>
                <BadgeEstado estado={proveedor.estado} />
              </TableCell>
              <TableCell data-align="end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Acciones para ${proveedor.nombre}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEditar(proveedor)}>
                      <PencilIcon className="text-petroleo" />
                      Editar proveedor
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => onEliminar(proveedor)}>
                      <Trash2Icon />
                      Eliminar proveedor
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

export { ProveedoresTabla }
