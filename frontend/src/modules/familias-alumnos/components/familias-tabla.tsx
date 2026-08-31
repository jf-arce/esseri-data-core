import { MoreHorizontalIcon, PencilIcon, Trash2Icon, EyeIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
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
import type { Familia } from '../types'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-48', anchoAlt: 'h-4 w-36' },
  { tipo: 'texto', ancho: 'h-4 w-32', anchoAlt: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-40', anchoAlt: 'h-4 w-28' },
  { tipo: 'chip', ancho: 'w-24', anchoAlt: 'w-20' },
  { tipo: 'accion' },
]

function BadgeEstadoDeuda({ estado }: { estado: string | null }) {
  if (estado === 'con_deuda') return <Badge variant="advertencia">Con deuda</Badge>
  if (estado === 'en_mora') return <Badge variant="error">En mora</Badge>
  return <Badge variant="exito">Al día</Badge>
}

interface FamiliasTablaProps {
  familias: Familia[]
  cargando: boolean
  densidad: 'comfortable' | 'compact'
  onEliminar: (familia: Familia) => void
}

export function FamiliasTabla({
  familias,
  cargando,
  densidad,
  onEliminar,
}: FamiliasTablaProps) {
  const navigate = useNavigate()

  return (
    <Table data-density={densidad === 'compact' ? 'compact' : undefined}>
      <TableHeader>
        <TableRow>
          <TableHead>Familia</TableHead>
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
          familias.map((familia) => (
            <TableRow
              key={familia.id}
              className="cursor-pointer"
              onClick={() => navigate(`/familias-alumnos/familias/${familia.id}`)}
            >
              <TableCell className="font-medium text-texto">
                {familia.persona_nombre} {familia.persona_apellido}
              </TableCell>
              <TableCell className="text-texto-2">
                {familia.persona_telefono ?? '—'}
              </TableCell>
              <TableCell>
                <BadgeEstadoDeuda estado={familia.estado_deuda} />
              </TableCell>
              <TableCell data-align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Acciones"
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => navigate(`/familias-alumnos/familias/${familia.id}`)}
                    >
                      <EyeIcon className="text-petroleo" />
                      Ver ficha
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        navigate(`/familias-alumnos/familias/${familia.id}/editar`)
                      }
                    >
                      <PencilIcon className="text-petroleo" />
                      Editar datos
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => onEliminar(familia)}
                    >
                      <Trash2Icon />
                      Dar de baja
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
