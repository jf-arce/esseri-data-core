import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'

// Esqueleto de carga (§9.5 DESIGN.md): "la forma real del layout final", no un spinner suelto.
// Cada página declara sus columnas para que el ancho/forma del esqueleto coincida con el dato
// que va a cargar en esa celda, en vez de un `FilaEsqueleto` propio y desalineado por tabla.
// `anchoAlt` (opcional) es el ancho que toman las filas pares: nombres, descripciones y demás
// texto real nunca miden todos lo mismo, así que alternar dos anchos por columna evita el
// efecto "maqueta" de barras idénticas fila tras fila.
type ColumnaEsqueleto =
  | { tipo: 'texto'; ancho?: string; anchoAlt?: string }
  | { tipo: 'avatar'; ancho?: string; anchoAlt?: string }
  | { tipo: 'chip'; ancho?: string; anchoAlt?: string }
  | { tipo: 'chips' }
  | { tipo: 'checkbox' }
  | { tipo: 'accion' }

function anchoDeFila(ancho: string, anchoAlt: string | undefined, fila: number): string {
  if (!anchoAlt) return ancho
  return fila % 2 === 0 ? ancho : anchoAlt
}

function CeldaEsqueleto({ columna, fila }: { columna: ColumnaEsqueleto; fila: number }) {
  switch (columna.tipo) {
    case 'avatar':
      return (
        <TableCell>
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className={anchoDeFila(columna.ancho ?? 'h-4 w-32', columna.anchoAlt, fila)} />
          </div>
        </TableCell>
      )
    case 'chip':
      return (
        <TableCell>
          <Skeleton
            className={cn(anchoDeFila(columna.ancho ?? 'w-20', columna.anchoAlt, fila), 'h-[22px] rounded-full')}
          />
        </TableCell>
      )
    case 'chips':
      return (
        <TableCell>
          <div className="flex gap-1.5">
            <Skeleton className="h-[22px] w-16 rounded-full" />
            {/* Un usuario con un solo rol es tan común como uno con varios: alternar el
                segundo chip evita que la columna "Roles" parezca siempre doble. */}
            {fila % 2 === 0 && <Skeleton className="h-[22px] w-14 rounded-full" />}
          </div>
        </TableCell>
      )
    case 'checkbox':
      return (
        <TableCell data-align="end">
          <Skeleton className="mx-auto size-4 rounded-[5px]" />
        </TableCell>
      )
    case 'accion':
      return (
        <TableCell data-align="end">
          <Skeleton className="ml-auto size-8 rounded-full" />
        </TableCell>
      )
    case 'texto':
    default:
      return (
        <TableCell>
          <Skeleton className={anchoDeFila(columna.ancho ?? 'h-4 w-28', columna.anchoAlt, fila)} />
        </TableCell>
      )
  }
}

interface TableSkeletonProps {
  columnas: ColumnaEsqueleto[]
  filas?: number
}

function TableSkeleton({ columnas, filas = 6 }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: filas }).map((_, i) => (
        <TableRow key={i}>
          {columnas.map((columna, j) => (
            <CeldaEsqueleto key={j} columna={columna} fila={i} />
          ))}
        </TableRow>
      ))}
    </>
  )
}

export { TableSkeleton }
export type { ColumnaEsqueleto }
