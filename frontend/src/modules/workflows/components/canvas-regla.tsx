import type { ReactNode } from 'react'
import { ArrowLeftRightIcon, MessageSquareIcon, ZapIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NodoRegla = 'disparador' | 'condicion' | 'accion'

export interface ResumenNodo {
  titulo: string
  detalle: string
}

interface CanvasReglaProps {
  seleccionado: NodoRegla
  onSeleccionar: (nodo: NodoRegla) => void
  disparador: ResumenNodo
  condicion: ResumenNodo
  accion: ResumenNodo
}

interface EstiloNodo {
  etiqueta: string
  icono: ReactNode
  superficie: string
  acento: string
  contorno: string
  posicion: string
}

// Superficies tonales del mockup "Editor de regla" (DESIGN.md §9.10): disparador en violeta de
// workflows, condición en advertencia y acción en el teal de inscripciones/IA.
const NODOS: Record<NodoRegla, EstiloNodo> = {
  disparador: {
    etiqueta: 'Disparador',
    icono: <ZapIcon />,
    superficie: 'bg-sup-workflows',
    acento: 'text-mod-workflows',
    contorno: 'outline-mod-workflows',
    posicion: 'left-6 top-10',
  },
  condicion: {
    etiqueta: 'Condición',
    icono: <ArrowLeftRightIcon />,
    superficie: 'bg-advertencia-suave',
    acento: 'text-advertencia',
    contorno: 'outline-advertencia',
    posicion: 'left-[270px] top-[124px]',
  },
  accion: {
    etiqueta: 'Acción',
    icono: <MessageSquareIcon />,
    superficie: 'bg-sup-inscripciones',
    acento: 'text-mod-inscripciones',
    contorno: 'outline-mod-inscripciones',
    posicion: 'left-[516px] top-[208px]',
  },
}

const ORDEN_NODOS: NodoRegla[] = ['disparador', 'condicion', 'accion']

function Nodo({
  tipo,
  resumen,
  seleccionado,
  onSeleccionar,
}: {
  tipo: NodoRegla
  resumen: ResumenNodo
  seleccionado: boolean
  onSeleccionar: () => void
}) {
  const estilo = NODOS[tipo]
  return (
    <button
      type="button"
      aria-pressed={seleccionado}
      onClick={onSeleccionar}
      className={cn(
        'absolute h-[92px] w-[190px] cursor-pointer rounded-[14px] px-[15px] py-[13px] text-left shadow-card transition-shadow hover:shadow-md',
        estilo.superficie,
        estilo.posicion,
        seleccionado && cn('outline-2 outline-offset-[3px]', estilo.contorno),
      )}
    >
      <span
        className={cn(
          'mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[.06em] uppercase',
          estilo.acento,
        )}
      >
        <span className="flex size-5 items-center justify-center rounded-[7px] bg-white/60 [&>svg]:size-3">
          {estilo.icono}
        </span>
        {estilo.etiqueta}
      </span>
      <span className="block truncate text-[13.5px] font-semibold text-texto">
        {resumen.titulo}
      </span>
      <span className="mt-0.5 block truncate text-[11px] text-texto-2">{resumen.detalle}</span>
    </button>
  )
}

/** Visualización fija de la regla (DESIGN.md §9.10): el backend modela exactamente un evento,
 * una condición y una acción, así que los nodos no se mueven ni se reconectan. Elegir un nodo
 * muestra su panel de configuración. */
export function CanvasRegla({
  seleccionado,
  onSeleccionar,
  disparador,
  condicion,
  accion,
}: CanvasReglaProps) {
  const resumenes: Record<NodoRegla, ResumenNodo> = { disparador, condicion, accion }
  return (
    <div className="overflow-x-auto rounded-panel bg-lienzo shadow-card">
      <div
        className="relative h-[340px] min-w-[740px]"
        style={{
          backgroundImage: 'radial-gradient(var(--borde) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        <svg aria-hidden="true" className="absolute inset-0 size-full" fill="none">
          <path
            d="M214,86 C244,86 244,170 270,170"
            strokeWidth="2.5"
            className="stroke-advertencia"
          />
          <path
            d="M460,170 C488,170 488,254 516,254"
            strokeWidth="2.5"
            className="stroke-mod-inscripciones"
          />
        </svg>
        {ORDEN_NODOS.map((tipo) => (
          <Nodo
            key={tipo}
            tipo={tipo}
            resumen={resumenes[tipo]}
            seleccionado={seleccionado === tipo}
            onSeleccionar={() => onSeleccionar(tipo)}
          />
        ))}
      </div>
    </div>
  )
}
