import type { BloqueKpi } from '../types'

function formatearValor(bloque: BloqueKpi): string {
  if (bloque.valor === null) return 'Sin registros'
  if (typeof bloque.valor === 'string') return bloque.valor
  const numero = bloque.valor.toLocaleString('es-AR')
  if (bloque.unidad === '$') return `$ ${numero}`
  return bloque.unidad === '' ? numero : `${numero} ${bloque.unidad}`
}

/** Indicador con su período y su fuente: sin ellos una cifra no se puede auditar. */
export function BloqueKpiVista({ bloque }: { bloque: BloqueKpi }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie p-3">
      <p className="text-xs text-texto-3">{bloque.titulo}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-texto">
        {formatearValor(bloque)}
      </p>
      <p className="mt-1 text-xs text-texto-3">
        {bloque.periodo} · {bloque.fuente}
      </p>
    </div>
  )
}
