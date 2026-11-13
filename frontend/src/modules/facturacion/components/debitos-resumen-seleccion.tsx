import { DownloadIcon, EraserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { ResumenSeleccionDebitos } from '@/modules/facturacion/types'
import { formatearMoneda } from '@/modules/facturacion/utils'

interface DebitosResumenSeleccionProps {
  resumen: ResumenSeleccionDebitos
  cargando: boolean
  total: number
  exportando: boolean
  onExportar: () => void
  onLimpiar: () => void
}

export function DebitosResumenSeleccion({
  resumen,
  cargando,
  total,
  exportando,
  onExportar,
  onLimpiar,
}: DebitosResumenSeleccionProps) {
  const cbu = resumen.por_medio.cbu ?? { cantidad: 0, importe: '0.00' }
  const tarjeta = resumen.por_medio.tarjeta ?? { cantidad: 0, importe: '0.00' }

  return (
    <aside
      aria-label="Resumen del lote"
      className="min-w-0 w-full rounded-panel border border-borde bg-superficie p-5 shadow-card"
    >
      <h2 className="text-base font-semibold text-texto">Resumen del lote</h2>
      <p className="mt-0.5 text-xs text-texto-2">
        Selección: {resumen.alcance === 'filtrados' ? 'todos los filtrados' : 'solo esta página'}
      </p>

      {cargando ? (
        <Skeleton className="mt-3 h-8 w-40" />
      ) : (
        <p className="mt-3 text-2xl font-semibold tabular-nums text-texto">
          {formatearMoneda(resumen.importe_total)}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="text-texto-2">Facturas seleccionadas</dt>
        <dd className="text-right font-medium tabular-nums">{resumen.cantidad}</dd>
        <dt className="text-texto-2">Débito en CBU</dt>
        <dd className="text-right font-medium tabular-nums">{cbu.cantidad}</dd>
        <dt className="text-texto-2">Débito con tarjeta</dt>
        <dd className="text-right font-medium tabular-nums">{tarjeta.cantidad}</dd>
        <dt className="text-texto-2">Coinciden con filtros</dt>
        <dd className="text-right font-medium tabular-nums">{total}</dd>
        <dt className="text-texto-2">Ocultas: ya están en otro lote</dt>
        <dd className="text-right font-medium tabular-nums">{resumen.ocultas_en_lote}</dd>
      </dl>

      <Button
        className="mt-5 w-full"
        disabled={resumen.cantidad === 0 || exportando}
        onClick={onExportar}
      >
        <DownloadIcon data-icon="inline-start" />
        Exportar {resumen.cantidad} solicitudes
      </Button>
      <Button
        variant="secondary"
        className="mt-2 w-full"
        disabled={resumen.cantidad === 0 || exportando}
        onClick={onLimpiar}
      >
        <EraserIcon data-icon="inline-start" />
        Limpiar selección
      </Button>

      <p className="mt-3 text-xs leading-relaxed text-texto-2">
        Las facturas de lotes exportados no se pueden incluir de nuevo, para evitar doble cobro.
        Exportar no registra pagos: se registran recién al importar y confirmar los resultados.
      </p>
    </aside>
  )
}
