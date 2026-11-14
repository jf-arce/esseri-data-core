import type { BloqueKpi } from '../types'
import { formatearKpi, formatearVariacion } from '../utils'

/** Indicador con su período y su fuente: sin ellos una cifra no se puede auditar. */
export function BloqueKpiVista({ bloque }: { bloque: BloqueKpi }) {
  const variacion = bloque.variacion
  return (
    <div className="rounded-xl border border-borde bg-superficie p-3">
      <p className="text-xs text-texto-3">{bloque.titulo}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-texto">{formatearKpi(bloque)}</p>
      {bloque.periodo_comparado !== undefined && (
        <p className="mt-0.5 text-xs text-texto-3">
          {variacion === null || variacion === undefined ? (
            'Sin base de comparación'
          ) : (
            <span className={variacion >= 0 ? 'text-exito' : 'text-error'}>
              {variacion >= 0 ? '▲' : '▼'} {formatearVariacion(variacion)}
              <span className="sr-only">{variacion >= 0 ? ' más' : ' menos'}</span>
            </span>
          )}{' '}
          vs. {bloque.periodo_comparado}
        </p>
      )}
      <p className="mt-1 text-xs text-texto-3">
        {bloque.periodo} · {bloque.fuente}
      </p>
    </div>
  )
}
