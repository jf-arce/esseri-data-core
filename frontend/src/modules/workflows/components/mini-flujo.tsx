import type { NodoWorkflow } from '@/modules/workflows/types'
import { ETIQUETA_ACCION } from '@/modules/workflows/utils'

const MAX_ACCIONES = 3
const ALTO_ACCION = 20
const SEPARACION = 6

/** Resumen del flujo en SVG estático (no React Flow): disparador, condiciones y acciones. Es
 * liviano a propósito, para que una grilla de tarjetas no cargue un lienzo por regla. */
export function MiniFlujo({ nodos }: { nodos: NodoWorkflow[] }) {
  const condiciones = nodos.filter((nodo) => nodo.tipo === 'condicion')
  const acciones = nodos.filter((nodo) => nodo.tipo === 'accion')
  const visibles = acciones.slice(0, MAX_ACCIONES)
  const extra = acciones.length - visibles.length
  const filas = Math.max(1, visibles.length + (extra > 0 ? 1 : 0))
  const alto = filas * ALTO_ACCION + (filas - 1) * SEPARACION
  const centro = alto / 2
  const tieneCondicion = condiciones.length > 0
  const xCondicion = 44
  const xAcciones = tieneCondicion ? 84 : 52

  const descripcion = [
    'Disparador',
    tieneCondicion
      ? `${condiciones.length} ${condiciones.length === 1 ? 'condición' : 'condiciones'}`
      : null,
    ...acciones.map((nodo) => (nodo.tipo_accion ? ETIQUETA_ACCION[nodo.tipo_accion] : 'Acción')),
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <svg
      role="img"
      aria-label={`Flujo: ${descripcion}`}
      viewBox={`0 0 ${xAcciones + 64} ${alto}`}
      className="h-auto w-full max-w-60"
    >
      <title>{descripcion}</title>
      <g fill="none" strokeWidth="1.5" strokeLinecap="round">
        <line
          x1="14"
          y1={centro}
          x2={tieneCondicion ? xCondicion - 8 : xAcciones}
          y2={centro}
          stroke="var(--mod-workflows)"
        />
        {tieneCondicion &&
          visibles.map((_, indice) => (
            <path
              // El orden es fijo: no hay identidad que conservar entre renders.
              key={indice}
              d={`M ${xCondicion + 8} ${centro} C ${xCondicion + 24} ${centro}, ${xAcciones - 14} ${indice * (ALTO_ACCION + SEPARACION) + ALTO_ACCION / 2}, ${xAcciones} ${indice * (ALTO_ACCION + SEPARACION) + ALTO_ACCION / 2}`}
              stroke="var(--advertencia)"
            />
          ))}
        {!tieneCondicion &&
          visibles.map((_, indice) => (
            <path
              key={indice}
              d={`M 14 ${centro} C 30 ${centro}, ${xAcciones - 14} ${indice * (ALTO_ACCION + SEPARACION) + ALTO_ACCION / 2}, ${xAcciones} ${indice * (ALTO_ACCION + SEPARACION) + ALTO_ACCION / 2}`}
              stroke="var(--mod-workflows)"
            />
          ))}
      </g>
      <circle cx="10" cy={centro} r="6" fill="var(--mod-workflows)" />
      {tieneCondicion && (
        <rect
          x={xCondicion - 8}
          y={centro - 8}
          width="16"
          height="16"
          rx="2"
          transform={`rotate(45 ${xCondicion} ${centro})`}
          fill="var(--advertencia)"
        />
      )}
      {visibles.map((nodo, indice) => (
        <rect
          key={nodo.id}
          x={xAcciones}
          y={indice * (ALTO_ACCION + SEPARACION)}
          width="56"
          height={ALTO_ACCION}
          rx="5"
          fill={nodo.requiere_aprobacion_humana ? 'var(--advertencia)' : 'var(--mod-inscripciones)'}
        />
      ))}
      {extra > 0 && (
        <text
          x={xAcciones}
          y={visibles.length * (ALTO_ACCION + SEPARACION) + 14}
          fontSize="11"
          fontWeight="700"
          fill="var(--texto-2)"
        >
          +{extra}
        </text>
      )}
    </svg>
  )
}
