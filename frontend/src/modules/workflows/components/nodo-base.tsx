import { useState, type ReactNode } from 'react'
import {
  AlertCircleIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UnlinkIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BotonIcono } from '@/modules/workflows/components/boton-icono'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CatalogoBloques } from '@/modules/workflows/components/catalogo-bloques'
import { cn } from '@/lib/utils'
import type { EstadoNodoSimulado, RamaNodo, TipoAccion } from '@/modules/workflows/types'
import {
  CLASE_SIMULACION,
  ICONO_SIMULACION,
} from '@/modules/workflows/components/estado-simulacion'
import { TEXTO_SIMULACION } from '@/modules/workflows/utils-grafo'
import type { TipoAccionCatalogo } from '@/modules/workflows/types'

/** El nodo mide al menos esto y crece con su contenido hasta el máximo. */
export const ANCHO_NODO_MIN = 260
export const ANCHO_NODO_MAX = 380

/** Qué sabe cada nodo de la simulación en curso: su resultado y si ya se mostró. */
export interface SimulacionNodo {
  estado: EstadoNodoSimulado
  detalle: string | null
  /** Ya le tocó en el recorrido animado; antes de eso el nodo se ve neutro. */
  visible: boolean
}

export interface OpcionesAgregar {
  tiposAccion: TipoAccionCatalogo[]
  nombreEvento: string | null
  /** Se llama con `condicion` o con el tipo de acción elegida. */
  onAgregar: (rama: RamaNodo | null, que: 'condicion' | TipoAccion) => void
}

/** Color del anillo con el que un nodo "se enciende" al ser alcanzado. */
const ANILLO_SIMULACION: Record<EstadoNodoSimulado, string> = {
  cumple: 'anillo-exito',
  no_cumple: 'anillo-neutro',
  error: 'anillo-error',
  alcanzada: 'anillo-exito',
  requiere_aprobacion: 'anillo-atencion',
  diferida: 'anillo-info',
  no_implementada: 'anillo-neutro',
  config_invalida: 'anillo-error',
  no_alcanzado: 'anillo-neutro',
}

/** Resultado de la simulación sobre el nodo: círculo con ícono; el texto va en el aria-label y el tooltip. */
function InsigniaSimulacion({ simulacion }: { simulacion: SimulacionNodo }) {
  const texto = TEXTO_SIMULACION[simulacion.estado]
  return (
    <span
      role="img"
      aria-label={texto}
      title={simulacion.detalle ? `${texto}: ${simulacion.detalle}` : texto}
      className={cn(
        'insignia-pop insignia-check inline-flex size-7 items-center justify-center rounded-full [&>svg]:size-4 [&>svg]:stroke-[3]',
        CLASE_SIMULACION[simulacion.estado],
      )}
    >
      {ICONO_SIMULACION[simulacion.estado]}
    </span>
  )
}

/** Lo que se puede hacer con un nodo desde su menú de tres puntos. El disparador solo se edita. */
export interface AccionesNodo {
  soloLectura: boolean
  onEditar: () => void
  onDuplicar?: () => void
  onEliminar?: () => void
}

function MenuNodo({ acciones }: { acciones: AccionesNodo }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BotonIcono
          etiqueta="Más acciones del bloque"
          lado="top"
          className="nodrag nopan -my-1 -mr-1.5 size-7 min-h-0"
        >
          <EllipsisVerticalIcon />
        </BotonIcono>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="nodrag nopan">
        <DropdownMenuItem onSelect={acciones.onEditar}>
          <PencilIcon />
          {acciones.soloLectura ? 'Ver' : 'Editar'}
        </DropdownMenuItem>
        {!acciones.soloLectura && acciones.onDuplicar && (
          <DropdownMenuItem onSelect={acciones.onDuplicar}>
            <CopyIcon />
            Duplicar
          </DropdownMenuItem>
        )}
        {!acciones.soloLectura && acciones.onEliminar && (
          <DropdownMenuItem variant="destructive" onSelect={acciones.onEliminar}>
            <Trash2Icon />
            Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface TarjetaNodoProps {
  etiqueta: string
  icono: ReactNode
  /** Clases de superficie y de acento del tipo de nodo. */
  superficie: string
  acento: string
  contorno: string
  seleccionado: boolean
  incompleto?: string
  /** Aviso que no impide guardar (p. ej. bloque sin conectar). */
  aviso?: string
  simulacion?: SimulacionNodo
  acciones?: AccionesNodo
  children: ReactNode
}

// Card tonal sin borde (§9.10). El contorno marca el nodo seleccionado.
export function TarjetaNodo({
  etiqueta,
  icono,
  superficie,
  acento,
  contorno,
  seleccionado,
  incompleto,
  aviso,
  simulacion,
  acciones,
  children,
}: TarjetaNodoProps) {
  const atenuado = simulacion?.visible && simulacion.estado === 'no_alcanzado'
  return (
    <div
      style={{ minWidth: ANCHO_NODO_MIN, maxWidth: ANCHO_NODO_MAX, width: 'max-content' }}
      className={cn(
        'nodo-entrar relative rounded-card-sm p-3.5 break-words [overflow-wrap:anywhere] shadow-card transition-opacity duration-200',
        superficie,
        seleccionado && cn('outline-2 outline-offset-2', contorno),
        incompleto && !seleccionado && 'outline-2 outline-offset-2 outline-error',
        atenuado && 'opacity-40',
        simulacion?.visible &&
          simulacion.estado !== 'no_alcanzado' && [
            'nodo-alcanzado',
            ANILLO_SIMULACION[simulacion.estado],
          ],
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs font-bold tracking-[.06em] uppercase [&>svg]:size-3.5',
            acento,
          )}
        >
          {icono}
          {etiqueta}
        </span>
        <span className="flex items-center gap-1.5">
          {simulacion?.visible && <InsigniaSimulacion simulacion={simulacion} />}
          {acciones && <MenuNodo acciones={acciones} />}
        </span>
      </div>
      {children}
      {incompleto && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-error [&>svg]:size-3.5">
          <AlertCircleIcon />
          Incompleto: {incompleto}
        </p>
      )}
      {aviso && !incompleto && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-texto-2 [&>svg]:size-3.5">
          <UnlinkIcon />
          Sin conectar: {aviso}
        </p>
      )}
    </div>
  )
}

interface BotonSumarProps extends OpcionesAgregar {
  rama: RamaNodo | null
  etiqueta: string
  /** Es el siguiente paso sugerido (lienzo vacío): se resalta. */
  resaltado?: boolean
  deshabilitado?: boolean
  /** Hacia dónde sale el tooltip; con dos salidas apiladas evita que uno tape al otro. */
  ladoTooltip?: 'top' | 'bottom'
}

/** El "+" de una salida: menú rápido que crea el bloque ya conectado a esa salida. */
export function BotonSumar({
  rama,
  etiqueta,
  resaltado,
  deshabilitado,
  ladoTooltip = 'bottom',
  tiposAccion,
  nombreEvento,
  onAgregar,
}: BotonSumarProps) {
  const [abierto, setAbierto] = useState(false)
  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <TooltipProvider>
        <Tooltip open={abierto ? false : undefined}>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                aria-label={etiqueta}
                disabled={deshabilitado}
                className={cn(
                  'nodrag nopan size-7 min-h-0 rounded-full',
                  resaltado && 'outline-2 outline-offset-2 outline-mod-workflows',
                )}
              >
                <PlusIcon className="size-4" />
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side={ladoTooltip} sideOffset={2}>
            {etiqueta}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="start" className="nodrag nopan nowheel w-[300px] overflow-hidden p-0">
        <CatalogoBloques
          tiposAccion={tiposAccion}
          nombreEvento={nombreEvento}
          soloLectura={Boolean(deshabilitado)}
          onElegir={(que) => {
            onAgregar(rama, que)
            setAbierto(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
