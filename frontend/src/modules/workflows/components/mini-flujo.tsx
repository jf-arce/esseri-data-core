import type { NodoWorkflow } from '@/modules/workflows/types'
import { ETIQUETA_ACCION } from '@/modules/workflows/utils'

const MAX_ACCIONES = 3
const ALTO_ACCION = 22
const ANCHO_ACCION = 84
const SEPARACION = 6
const MAX_LETRAS = 12

function etiquetaCorta(nodo: NodoWorkflow): string {
  const nombre = nodo.tipo_accion ? ETIQUETA_ACCION[nodo.tipo_accion] : 'Acción'
  return nombre.length > MAX_LETRAS ? `${nombre.slice(0, MAX_LETRAS - 1)}…` : nombre
}

/** Resumen del flujo en SVG (no React Flow): disparador (círculo con rayo), condición (rombo) y
 * acciones (pastillas, con candado si piden aprobación). Si la regla está activa, un pulso recorre
 * las aristas; inactiva va en gris y quieta. Es liviano a propósito, para que una grilla de
 * tarjetas no cargue un lienzo por regla. */
export function MiniFlujo({ nodos, activo = true }: { nodos: NodoWorkflow[]; activo?: boolean }) {
  const condiciones = nodos.filter((nodo) => nodo.tipo === 'condicion')
  const acciones = nodos.filter((nodo) => nodo.tipo === 'accion')
  const visibles = acciones.slice(0, MAX_ACCIONES)
  const extra = acciones.length - visibles.length
  const filas = Math.max(1, visibles.length + (extra > 0 ? 1 : 0))
  const alto = Math.max(24, filas * ALTO_ACCION + (filas - 1) * SEPARACION)
  const centro = alto / 2
  const tieneCondicion = condiciones.length > 0
  const xCondicion = 56
  const xAcciones = tieneCondicion ? 96 : 56
  const xInicioArista = 22
  const yFila = (indice: number) => indice * (ALTO_ACCION + SEPARACION) + ALTO_ACCION / 2

  const colorDisparador = activo ? 'var(--mod-workflows)' : 'var(--texto-3)'
  const colorCondicion = activo ? 'var(--advertencia)' : 'var(--texto-3)'
  const colorArista = activo ? 'var(--mod-workflows)' : 'var(--borde-fuerte, var(--texto-3))'
  const claseViaje = activo ? 'mini-flujo-viaje' : undefined

  const descripcion = [
    'Disparador',
    tieneCondicion
      ? `${condiciones.length} ${condiciones.length === 1 ? 'condición' : 'condiciones'}`
      : null,
    ...acciones.map((nodo) => (nodo.tipo_accion ? ETIQUETA_ACCION[nodo.tipo_accion] : 'Acción')),
  ]
    .filter(Boolean)
    .join(', ')

  const aristas: string[] = []
  if (tieneCondicion) {
    aristas.push(`M ${xInicioArista} ${centro} L ${xCondicion - 12} ${centro}`)
    visibles.forEach((_, indice) =>
      aristas.push(
        `M ${xCondicion + 12} ${centro} C ${xCondicion + 26} ${centro}, ${xAcciones - 16} ${yFila(indice)}, ${xAcciones} ${yFila(indice)}`,
      ),
    )
  } else {
    visibles.forEach((_, indice) =>
      aristas.push(
        `M ${xInicioArista} ${centro} C ${xInicioArista + 14} ${centro}, ${xAcciones - 16} ${yFila(indice)}, ${xAcciones} ${yFila(indice)}`,
      ),
    )
  }

  return (
    <svg
      role="img"
      aria-label={`Flujo: ${descripcion}`}
      viewBox={`0 0 ${xAcciones + ANCHO_ACCION + 4} ${alto}`}
      className={`h-auto w-full max-w-72 ${activo ? '' : 'opacity-70'}`}
    >
      <title>{descripcion}</title>
      <g fill="none" strokeWidth="1.5" strokeLinecap="round">
        {aristas.map((trazo, indice) => (
          // El orden es fijo: no hay identidad que conservar entre renders.
          <path key={indice} d={trazo} stroke={colorArista} opacity={activo ? 0.45 : 1} />
        ))}
        {activo &&
          aristas.map((trazo, indice) => (
            <path
              key={`viaje-${indice}`}
              d={trazo}
              pathLength={1}
              stroke={colorArista}
              strokeWidth="2.5"
              className={claseViaje}
            />
          ))}
      </g>
      <circle cx="12" cy={centro} r="10" fill={colorDisparador} />
      <path
        d={`M 13.5 ${centro - 6} L 8.5 ${centro + 1} L 12 ${centro + 1} L 10.5 ${centro + 6} L 15.5 ${centro - 1} L 12 ${centro - 1} Z`}
        fill="white"
      />
      {tieneCondicion && (
        <polygon
          points={`${xCondicion},${centro - 12} ${xCondicion + 12},${centro} ${xCondicion},${centro + 12} ${xCondicion - 12},${centro}`}
          fill={colorCondicion}
        />
      )}
      {tieneCondicion && (
        <text
          x={xCondicion}
          y={centro + 3.5}
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fill="white"
        >
          {condiciones.length}
        </text>
      )}
      {visibles.map((nodo, indice) => {
        const aprobacion = nodo.requiere_aprobacion_humana
        const color = !activo
          ? 'var(--texto-3)'
          : aprobacion
            ? 'var(--advertencia)'
            : 'var(--mod-inscripciones)'
        const y = indice * (ALTO_ACCION + SEPARACION)
        return (
          <g key={nodo.id}>
            <rect
              x={xAcciones}
              y={y}
              width={ANCHO_ACCION}
              height={ALTO_ACCION}
              rx="11"
              fill={color}
            />
            {aprobacion && (
              <g fill="white">
                <rect x={xAcciones + 7} y={y + 10} width="7" height="6" rx="1" />
                <path
                  d={`M ${xAcciones + 8.5} ${y + 10} v -2 a 2 2 0 0 1 4 0 v 2`}
                  fill="none"
                  stroke="white"
                  strokeWidth="1.2"
                />
              </g>
            )}
            <text
              x={xAcciones + (aprobacion ? 18 : 9)}
              y={y + 14.5}
              fontSize="9.5"
              fontWeight="600"
              fill="white"
            >
              {etiquetaCorta(nodo)}
            </text>
          </g>
        )
      })}
      {extra > 0 && (
        <text
          x={xAcciones + 4}
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
