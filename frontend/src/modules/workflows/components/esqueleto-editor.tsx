import { ArrowLeftRightIcon, SendIcon, ZapIcon } from 'lucide-react'
import { useCallback, type RefObject } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { BarraEditor } from '@/modules/workflows/components/barra-editor'
import { PARAMETRO_REGLA_ID } from '@/modules/workflows/constants'

const NODOS = [
  { Icono: ZapIcon, fase: 'origen' },
  {
    Icono: ArrowLeftRightIcon,
    fase: 'condicion',
  },
  { Icono: SendIcon, fase: 'accion-si' },
  { Icono: SendIcon, fase: 'accion-no' },
]

const DISPOSICIONES = {
  horizontal: {
    vista: '0 0 472 176',
    clase: 'hidden max-w-[472px] @lg:block',
    nodos: [
      [4, 60],
      [172, 60],
      [356, 4],
      [356, 116],
    ],
    rutas: [
      'M116 88 H172',
      'M284 88 H304 Q314 88 314 78 V42 Q314 32 324 32 H356',
      'M284 88 H304 Q314 88 314 98 V134 Q314 144 324 144 H356',
    ],
    etiquetas: [
      [337, 24],
      [337, 136],
    ],
  },
  vertical: {
    vista: '0 0 244 274',
    clase: 'max-w-[244px] @lg:hidden',
    nodos: [
      [66, 4],
      [66, 94],
      [4, 214],
      [128, 214],
    ],
    rutas: [
      'M122 60 V94',
      'M122 150 V168 Q122 178 112 178 H70 Q60 178 60 188 V214',
      'M122 150 V168 Q122 178 132 178 H174 Q184 178 184 188 V214',
    ],
    etiquetas: [
      [46, 200],
      [199, 200],
    ],
  },
}

function DiagramaEsqueleto({ disposicion }: { disposicion: keyof typeof DISPOSICIONES }) {
  const { vista, clase, nodos, rutas, etiquetas } = DISPOSICIONES[disposicion]

  return (
    <svg viewBox={vista} className={`h-auto w-full overflow-visible ${clase}`}>
      {rutas.map((ruta, indice) => (
        <g key={ruta} fill="none" strokeLinecap="round" strokeWidth="2">
          <path d={ruta} className="stroke-texto/20" />
          <path
            d={ruta}
            pathLength="1"
            className={`esqueleto-trazo ${indice === 0 ? 'esqueleto-tramo' : 'esqueleto-rama'} stroke-texto/55`}
          />
        </g>
      ))}
      {etiquetas.map(([x, y], indice) => (
        <text
          key={`${x}-${y}`}
          x={x}
          y={y}
          textAnchor="middle"
          className="fill-texto/55 text-[10px] font-semibold"
        >
          {indice === 0 ? 'Sí' : 'No'}
        </text>
      ))}
      {NODOS.map(({ Icono, fase }, indice) => {
        const [x, y] = nodos[indice]
        return (
          <g key={fase} transform={`translate(${x} ${y})`} className="fill-texto/6 text-texto/55">
            <rect width="112" height="56" rx="12" stroke="currentColor" strokeOpacity=".35" />
            <rect
              width="112"
              height="56"
              rx="12"
              strokeWidth="2"
              className={`esqueleto-acento esqueleto-${fase} fill-none stroke-texto/55`}
            />
            <Icono x="12" y="18" width="20" height="20" fill="none" />
            <path
              d="M43 22 H77 M43 34 H94"
              stroke="currentColor"
              strokeWidth="5"
              strokeOpacity=".28"
              strokeLinecap="round"
            />
          </g>
        )
      })}
      {disposicion === 'horizontal' ? (
        <path
          className="stroke-texto/55"
          strokeWidth="5"
          strokeLinecap="round"
          d="M116 88h0 M172 88h0 M284 88h0 M356 32h0 M356 144h0"
        />
      ) : (
        <path
          className="stroke-texto/55"
          strokeWidth="5"
          strokeLinecap="round"
          d="M122 60h0 M122 94h0 M122 150h0 M60 214h0 M184 214h0"
        />
      )}
    </svg>
  )
}

export function EsqueletoEditor({ inicioPulso }: { inicioPulso?: RefObject<number | null> }) {
  const reglaId = useParams()[PARAMETRO_REGLA_ID]
  const [parametros] = useSearchParams()
  const titulo = reglaId
    ? 'Editar regla'
    : parametros.has('duplicar')
      ? 'Duplicar regla'
      : 'Nueva regla'
  const continuarPulso = useCallback(
    (diagrama: HTMLDivElement | null) => {
      if (!diagrama || !inicioPulso) return
      // Suspense reemplaza su fallback. Continuar el ciclo desde el primer skeleton visible.
      const ahora = performance.now()
      inicioPulso.current ??= ahora
      diagrama.style.setProperty('--esqueleto-demora', `${inicioPulso.current - ahora}ms`)
    },
    [inicioPulso],
  )

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[480px] flex-col gap-3">
      <span role="status" className="sr-only">
        Cargando el editor
      </span>
      <BarraEditor
        titulo={titulo}
        mostrarTituloEnMovil
        nombre=""
        activo
        soloLectura={false}
        guardando={false}
        cargando
        puedeDuplicar={false}
        onCambiarNombre={() => undefined}
        onCambiarActivo={() => undefined}
        onDuplicar={() => undefined}
        onGuardar={() => undefined}
      />
      <div
        className="@container relative min-h-0 flex-1 overflow-hidden rounded-panel bg-superficie shadow-card"
        aria-hidden="true"
        style={{
          backgroundImage: 'radial-gradient(var(--borde) 1.5px, transparent 1.5px)',
          backgroundSize: '20px 20px',
        }}
      >
        <div ref={continuarPulso} className="grid h-full place-items-center px-3">
          <DiagramaEsqueleto disposicion="horizontal" />
          <DiagramaEsqueleto disposicion="vertical" />
        </div>
      </div>
    </div>
  )
}
