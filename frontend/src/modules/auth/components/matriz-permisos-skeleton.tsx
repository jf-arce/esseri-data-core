import { Skeleton } from '@/components/ui/skeleton'

// Mismas clases que `MatrizPermisos` (w-45/w-34, px-6/px-2/px-3, py-3/py-2.5): un
// <table> real con las mismas columnas fijas, no una fila flex aproximada — si no, las
// columnas de acá no coinciden con las de la tabla real y se nota un salto al cargar.
function MatrizPermisosSkeleton() {
  return (
    <div className="overflow-x-auto rounded-panel bg-superficie shadow-card">
      <table className="w-full min-w-[1540px] table-fixed border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-[1] w-45 border-b border-borde bg-superficie px-6 py-3 text-left">
              <Skeleton className="h-3.5 w-32" />
            </th>
            {Array.from({ length: 10 }).map((_, i) => (
              <th key={i} className="w-34 border-b border-borde px-2 py-3">
                <Skeleton className="mx-auto h-3.5 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i}>
              <td className="sticky left-0 z-[1] border-b border-borde bg-superficie px-6 py-2.5">
                <Skeleton className={i % 2 === 0 ? 'h-4 w-40' : 'h-4 w-52'} />
              </td>
              {Array.from({ length: 10 }).map((_, j) => (
                <td key={j} className="border-b border-borde px-3 py-2.5 text-center">
                  <Skeleton className="mx-auto size-4 rounded-[5px]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { MatrizPermisosSkeleton }
