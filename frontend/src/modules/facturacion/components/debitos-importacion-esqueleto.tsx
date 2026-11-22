import { CircleCheckIcon, CircleXIcon, FilesIcon, TriangleAlertIcon } from 'lucide-react'
import { StatTile } from '@/components/stat-tile'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-32', anchoAlt: 'h-4 w-24' },
  { tipo: 'texto', ancho: 'h-4 w-48', anchoAlt: 'h-4 w-36' },
  { tipo: 'chip', ancho: 'w-20' },
  { tipo: 'texto', ancho: 'h-4 w-24' },
]

const ICONOS = [CircleCheckIcon, FilesIcon, CircleXIcon, TriangleAlertIcon]
const ETIQUETAS = ['Cobrados', 'Procesados', 'Rechazados', 'Errores']

// Primera carga de una importación: todavía no hay datos, así que se dibuja la forma final
// (resumen, tabla y panel). Los rótulos y cabeceras son estáticos y se muestran reales.
export function DebitosImportacionEsqueleto() {
  return (
    <>
      <section
        aria-hidden="true"
        className="grid min-w-0 gap-3 grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]"
      >
        {ETIQUETAS.map((etiqueta, indice) => (
          <StatTile
            key={etiqueta}
            compact
            label={etiqueta}
            value=""
            icon={ICONOS[indice]}
            cargando
          />
        ))}
      </section>
      <div
        aria-hidden="true"
        className="grid min-w-0 items-start gap-4 @7xl/main:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="min-w-0 w-full rounded-panel bg-superficie shadow-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-borde p-3">
            <Skeleton className="h-9 w-full max-w-md rounded-full" />
          </div>
          <Table bare minWidth="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Alumno</TableHead>
                <TableHead>Motivo informado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead data-align="end" className="w-32">
                  Importe
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={6} />
            </TableBody>
          </Table>
        </div>
        <div className="flex min-w-0 w-full flex-col gap-3 rounded-panel border border-borde bg-superficie p-5 shadow-card">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </>
  )
}
