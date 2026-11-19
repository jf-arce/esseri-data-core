import { CircleCheckIcon, CircleXIcon, FilesIcon, TriangleAlertIcon } from 'lucide-react'
import { StatTile } from '@/components/stat-tile'
import type { ImportacionResumenDebitos } from '@/modules/facturacion/types'
import { formatearMoneda } from '@/modules/facturacion/utils'

interface DebitosImportacionResumenProps {
  resumen: ImportacionResumenDebitos
  cargando: boolean
}

export function DebitosImportacionResumen({ resumen, cargando }: DebitosImportacionResumenProps) {
  return (
    <section
      aria-label="Resumen de la importación"
      className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatTile
        compact
        label="Procesados"
        value={resumen.procesados.cantidad}
        note={formatearMoneda(resumen.procesados.importe)}
        icon={FilesIcon}
        cargando={cargando}
      />
      <StatTile
        compact
        label="Cobrados"
        value={resumen.cobrados.cantidad}
        note={formatearMoneda(resumen.cobrados.importe)}
        icon={CircleCheckIcon}
        iconClassName="bg-exito-suave text-exito"
        cargando={cargando}
      />
      <StatTile
        compact
        label="Rechazados"
        value={resumen.rechazados.cantidad}
        note={formatearMoneda(resumen.rechazados.importe)}
        icon={CircleXIcon}
        iconClassName="bg-fila-hover text-texto-2"
        cargando={cargando}
      />
      <StatTile
        compact
        label="Errores"
        value={resumen.errores.cantidad}
        note={formatearMoneda(resumen.errores.importe)}
        icon={TriangleAlertIcon}
        iconClassName="bg-error-suave text-error"
        cargando={cargando}
      />
    </section>
  )
}
