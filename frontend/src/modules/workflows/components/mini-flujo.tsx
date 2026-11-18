import type { NodoWorkflow } from '@/modules/workflows/types'
import { ETIQUETA_ACCION } from '@/modules/workflows/utils'

const MAX_ACCIONES = 3
const ALTO_ACCION = 22
const SEPARACION = 6
// Ancho aproximado por letra a 9.5px semibold: la pastilla crece para mostrar el nombre completo.
// El dibujo se ve a esta escala sobre su viewBox, igual en todas las tarjetas.
const ESCALA = 1.3
const ANCHO_LETRA = 5.5
// Layout fijo: la columna de la condición se reserva siempre, así el disparador, el rombo y las
// pastillas miden y se ubican igual en todas las tarjetas.
const X_CONDICION = 56
const X_BUS = 82
const X_ACCIONES = 94
const X_INICIO_ARISTA = 22

function etiqueta(nodo: NodoWorkflow): string {
  return nodo.tipo_accion ? ETIQUETA_ACCION[nodo.tipo_accion] : 'Acción'
}

let lienzo: CanvasRenderingContext2D | null | undefined

/** Ancho real del texto de la pastilla (misma fuente y tamaño que el SVG). Sin canvas, por
 * ejemplo en los tests, cae a una estimación por letra. */
function anchoTexto(texto: string): number {
  if (lienzo === undefined) {
    lienzo =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  }
  if (!lienzo) return texto.length * ANCHO_LETRA
  lienzo.font = "600 9.5px 'Geist Variable', sans-serif"
  return lienzo.measureText(texto).width
}

function rellenoPastilla(nodo: NodoWorkflow): number {
  return nodo.requiere_aprobacion_humana ? 27 : 18
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
  const contenido = filas * ALTO_ACCION + (filas - 1) * SEPARACION
  const alto = Math.max(24, contenido)
  const centro = alto / 2
  const desfase = (alto - contenido) / 2
  const tieneCondicion = condiciones.length > 0
  const xCondicion = X_CONDICION
  const xAcciones = X_ACCIONES
  const anchoPastilla = (nodo: NodoWorkflow) =>
    Math.ceil(anchoTexto(etiqueta(nodo)) + rellenoPastilla(nodo))
  const anchoTotal = X_ACCIONES + Math.max(0, ...visibles.map(anchoPastilla)) + 4
  const yTop = (indice: number) => desfase + indice * (ALTO_ACCION + SEPARACION)
  const yFila = (indice: number) => yTop(indice) + ALTO_ACCION / 2

  const colorDisparador = activo ? 'var(--mod-workflows)' : 'var(--texto-3)'
  const colorCondicion = activo ? 'var(--advertencia)' : 'var(--texto-3)'
  const colorArista = activo ? 'var(--mod-workflows)' : 'var(--borde-fuerte, var(--texto-3))'
  const claseViaje = activo ? 'mini-flujo-viaje' : undefined

  const descripcion = [
    'Evento',
    tieneCondicion
      ? `${condiciones.length} ${condiciones.length === 1 ? 'condición' : 'condiciones'}`
      : null,
    ...acciones.map((nodo) => (nodo.tipo_accion ? ETIQUETA_ACCION[nodo.tipo_accion] : 'Acción')),
  ]
    .filter(Boolean)
    .join(', ')

  // Trazos ortogonales: un tronco horizontal hasta el "bus" vertical y de ahí un tramo recto a
  // cada acción. Sin condición, el tronco sale del disparador.
  const aristas: string[] = []
  const xTronco = tieneCondicion ? xCondicion + 12 : X_INICIO_ARISTA
  if (tieneCondicion) aristas.push(`M ${X_INICIO_ARISTA} ${centro} H ${xCondicion - 12}`)
  visibles.forEach((_, indice) =>
    aristas.push(`M ${xTronco} ${centro} H ${X_BUS} V ${yFila(indice)} H ${xAcciones}`),
  )

  return (
    <svg
      role="img"
      aria-label={`Flujo: ${descripcion}`}
      viewBox={`0 0 ${anchoTotal} ${alto}`}
      width={anchoTotal * ESCALA}
      height={alto * ESCALA}
      className={`max-w-full ${activo ? '' : 'opacity-70'}`}
    >
      <title>{descripcion}</title>
      <g fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {aristas.map((trazo, indice) => (
          // El orden es fijo: no hay identidad que conservar entre renders.
          <path key={indice} d={trazo} stroke={colorArista} opacity={activo ? 0.45 : 1} />
        ))}
        {activo &&
          aristas.map((trazo, indice) => (
            <path
              key={`viaje-${indice}`}
              d={trazo}
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
            : 'var(--exito)'
        const y = yTop(indice)
        return (
          <g key={nodo.id}>
            <rect
              x={xAcciones}
              y={y}
              width={anchoPastilla(nodo)}
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
              {etiqueta(nodo)}
            </text>
          </g>
        )
      })}
      {extra > 0 && (
        <text
          x={xAcciones + 4}
          y={yTop(visibles.length) + 14}
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
