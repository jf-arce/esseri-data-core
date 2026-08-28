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
import type { Permiso } from '@/modules/auth/types'

// Mapeo del nombre de módulo (texto libre, coincide con `MODULOS` de `permiso-dialog.tsx`) al
// `data-modulo` del Badge (§9.3 DESIGN.md, familia de 8 dominios). "Autenticación" y "Panel
// Administrativo" no son dominios de negocio del sistema, así que no tienen color de módulo
// propio: quedan en el chip neutro.
const MODULO_A_BADGE: Record<string, string | undefined> = {
  'Familias y Alumnos': 'familias',
  Académico: 'academico',
  Inscripciones: 'inscripciones',
  Facturación: 'facturacion',
  'Proveedores y Compras': 'compras',
  Workflows: 'workflows',
  Auditoría: 'auditoria',
  'IA/Sugerencias': 'ia',
}

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'chip', ancho: 'w-24', anchoAlt: 'w-36' },
  { tipo: 'texto', ancho: 'h-4 w-16', anchoAlt: 'h-4 w-20' },
  { tipo: 'texto', ancho: 'h-4 w-8', anchoAlt: 'h-4 w-28' },
  { tipo: 'accion' },
]

function BadgeModulo({ modulo }: { modulo: string }) {
  const clave = MODULO_A_BADGE[modulo]
  if (!clave) return <Badge variant="secondary">{modulo}</Badge>
  return (
    <Badge variant="modulo" data-modulo={clave}>
      {modulo}
    </Badge>
  )
}

interface PermisosTablaProps {
  permisos: Permiso[]
  cargando: boolean
  densidad: 'comfortable' | 'compact'
  onEditar: (permiso: Permiso) => void
  onEliminar: (permiso: Permiso) => void
}

function PermisosTabla({ permisos, cargando, densidad, onEditar, onEliminar }: PermisosTablaProps) {
  return (
    <Table data-density={densidad === 'compact' ? 'compact' : undefined}>
      <TableHeader>
        <TableRow>
          <TableHead>Módulo</TableHead>
          <TableHead>Acción</TableHead>
          <TableHead>Tipo de información</TableHead>
          <TableHead data-align="end">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cargando ? (
          <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={8} />
        ) : (
          permisos.map((permiso) => (
            <TableRow key={permiso.id}>
              <TableCell>
                <BadgeModulo modulo={permiso.modulo} />
              </TableCell>
              <TableCell className="text-texto-2">{permiso.accion}</TableCell>
              <TableCell className="text-texto-2">{permiso.tipo_informacion ?? '—'}</TableCell>
              <TableCell data-align="end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${permiso.codigo}`}>
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEditar(permiso)}>
                      <PencilIcon className="text-petroleo" />
                      Editar permiso
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => onEliminar(permiso)}>
                      <Trash2Icon />
                      Eliminar permiso
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

export { PermisosTabla }
